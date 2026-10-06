// What the Explorer page knows and how it searches. No React here, so the logic can be run on its own.

export type Guide = { href: string; title: string };
export type WaxParam = { name: string; type: string; optional?: boolean; text?: string };
export type WaxReturn = { type: string; name?: string; text?: string };
export type WaxProp = {
  id: string;
  name: string;
  type: string;
  optional?: boolean;
  text?: string;
  use?: string;
  ref?: string;
  guide?: Guide;
};
export type WaxSignal = { id: string; name: string; type: string; receives?: string; open?: boolean; text?: string; use?: string };
export type WaxFunc = {
  id: string;
  name: string;
  call: string;
  params?: WaxParam[];
  returns?: WaxReturn[];
  generics?: string[];
  overloads?: string[];
  text?: string;
  ref?: string;
  guide?: Guide;
  use?: string;
  blocked?: boolean;
};
export type WaxKind = 'namespace' | 'object' | 'data' | 'alias' | 'globals' | 'blocked';
export type WaxType = {
  id: string;
  name: string;
  title: string;
  kind: WaxKind;
  group: string;
  text?: string;
  parents?: string[];
  generics?: string[];
  ref?: string;
  guide?: Guide;
  makers?: string[];
  users?: string[];
  use?: string;
  props?: WaxProp[];
  signals?: WaxSignal[];
  funcs?: WaxFunc[];
  type?: string;
  values?: { value: string; text?: string }[];
};
export type WaxGroup = { id: string; title: string; text: string; types: string[]; members: string[] };
export type WaxData = { groups: WaxGroup[]; spoken: Record<string, string>; types: WaxType[] };

export type GameSearch = { chunks: string[]; types: [name: string, chunk: number, kind: 'c' | 's' | 'e'][] };
export type GameTree = {
  format: number;
  taken: string;
  counts: Record<string, number>;
  parents: number[];
  keys: Record<string, string>;
  aliases: Record<string, number>;
};
export type GameMembers = Record<'p' | 'f' | 'e', Record<string, number[]>>;
export type GameProp = [name: string, type: string, example: string];
export type GameFunc = [name: string, params: [name: string, type: string][], returns: string, example: string, flags?: string[]];
export type GameType = {
  name: string;
  kind: 'class' | 'struct' | 'enum';
  from: string;
  parent?: string;
  origin?: 'native' | 'blueprint';
  props?: GameProp[];
  funcs?: GameFunc[];
  values?: [name: string, value: number][];
};

export type Kind = 'function' | 'event' | 'property' | 'class' | 'enum';
export type Source = 'wax' | 'game';
export const KINDS: [Kind, string][] = [
  ['function', 'Functions'],
  ['event', 'Events'],
  ['property', 'Properties'],
  ['class', 'Classes'],
  ['enum', 'Enums'],
];
export const SOURCES: [Source, string][] = [
  ['wax', 'Wax'],
  ['game', 'The game'],
];

export const firstSentence = (text: string) => /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
export const isDelegate = (type: string) => type.startsWith('delegate(');

// Cuts "a: X, b: table<K, V>" at the commas that are not inside brackets.
export function splitList(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '<' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '>' || c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

// "a: X, b: Y" as [name, type] pairs.
export function namedList(text: string): [string, string][] {
  return splitList(text).map((part) => {
    const cut = part.indexOf(':');
    return cut === -1 ? [part, 'any'] : [part.slice(0, cut).trim(), part.slice(cut + 1).trim()];
  });
}

// What a delegate hands to the functions bound to it. null when the text is not one delegate.
export function delegateParams(type: string): [string, string][] | null {
  const shape = /^delegate\((.*)\)$/.exec(type);
  return shape ? namedList(shape[1]) : null;
}

type WaxMember = { type: WaxType; kind: Kind; row: WaxProp | WaxSignal | WaxFunc };

export class WaxIndex {
  readonly types = new Map<string, WaxType>();
  readonly byName = new Map<string, WaxType>();
  readonly members = new Map<string, WaxMember>();
  readonly children = new Map<string, WaxType[]>();
  readonly spoken: RegExp | null;
  // Names Wax itself uses. `game.GameState` is a member of game, not the engine class of the same name.
  readonly ownNames = new Set<string>();

  constructor(readonly data: WaxData) {
    for (const type of data.types) {
      this.types.set(type.id, type);
      this.byName.set(type.name, type);
      this.ownNames.add(type.name);
      for (const parent of type.parents ?? []) this.children.set(parent, [...(this.children.get(parent) ?? []), type]);
      for (const row of type.props ?? []) this.members.set(row.id, { type, kind: 'property', row });
      for (const row of type.signals ?? []) this.members.set(row.id, { type, kind: 'event', row });
      for (const row of type.funcs ?? []) this.members.set(row.id, { type, kind: 'function', row });
    }
    for (const member of this.members.values()) this.ownNames.add(member.row.name);
    const names = Object.keys(data.spoken).sort((a, b) => b.length - a.length);
    this.spoken = names.length ? new RegExp(`(${names.map((name) => name.replace(/[.]/g, '\\.')).join('|')})(?![\\w(])`, 'g') : null;
  }

  // An address names a type ("ui") or one of its members ("ui.Notify").
  open(id: string): { type: WaxType; member: string } | null {
    const type = this.types.get(id);
    if (type) return { type, member: '' };
    const member = this.members.get(id);
    return member ? { type: member.type, member: member.row.name } : null;
  }

  // Every type this one is built on, nearest first.
  ancestors(type: WaxType): WaxType[] {
    const found: WaxType[] = [];
    const visit = (entry: WaxType) => {
      for (const name of entry.parents ?? []) {
        const parent = this.byName.get(name);
        if (!parent || found.includes(parent)) continue;
        found.push(parent);
        visit(parent);
      }
    };
    visit(type);
    return found;
  }
}

export class GameIndex {
  readonly size: number;
  readonly byKey = new Map<string, number>();
  readonly children: number[][];
  readonly roots: number[] = [];
  private depths: Int16Array;
  private below: Int32Array;
  private starts: number[] = [];

  constructor(
    readonly search: GameSearch,
    readonly tree: GameTree,
  ) {
    this.size = search.types.length;
    this.children = Array.from({ length: this.size }, () => []);
    this.depths = new Int16Array(this.size).fill(-1);
    this.below = new Int32Array(this.size).fill(-1);
    for (let index = 0; index < this.size; index++) {
      this.starts[this.chunk(index)] ??= index;
      this.byKey.set(this.key(index), index);
      const parent = tree.parents[index];
      if (parent >= 0) this.children[parent].push(index);
      else if (search.types[index][2] === 'c') this.roots.push(index);
    }
    const byName = (a: number, b: number) => this.name(a).localeCompare(this.name(b));
    for (const list of this.children) list.sort(byName);
    // Classes that others are built on come first, so Object leads the tree.
    const leads = (index: number) => Number(this.children[index].length > 0);
    this.roots.sort((a, b) => leads(b) - leads(a) || byName(a, b));
  }

  name(index: number) {
    return this.search.types[index][0];
  }
  kind(index: number) {
    return this.search.types[index][2];
  }
  chunk(index: number) {
    return this.search.types[index][1];
  }
  // Where the type sits inside its chunk. A chunk lists its types in the order of the search list.
  place(index: number) {
    return index - this.starts[this.chunk(index)];
  }
  // The name in an address. It is the type's own name unless two types share that name.
  key(index: number) {
    return Object.hasOwn(this.tree.keys, index) ? this.tree.keys[index] : this.name(index);
  }
  find(key: string): number | undefined {
    return this.byKey.get(key) ?? (Object.hasOwn(this.tree.aliases, key) ? this.tree.aliases[key] : undefined);
  }
  parent(index: number) {
    return this.tree.parents[index];
  }
  // Nearest first.
  ancestors(index: number): number[] {
    const found: number[] = [];
    for (let at = this.parent(index); at >= 0 && !found.includes(at); at = this.parent(at)) found.push(at);
    return found;
  }
  depth(index: number): number {
    if (this.depths[index] === -1) this.depths[index] = this.ancestors(index).length;
    return this.depths[index];
  }
  // How many types are built on this one, at any distance.
  descendants(index: number): number {
    if (this.below[index] === -1) {
      let count = 0;
      for (const child of this.children[index]) count += 1 + this.descendants(child);
      this.below[index] = count;
    }
    return this.below[index];
  }
}

// What a class name looks like in a sentence: two words run together, or words joined by underscores.
export const PROSE_WORD =
  /(Wax[A-Z]\w*|Actor|Pawn|Object|[A-Z][a-z0-9]+(?:[A-Z]+[a-z0-9]*)+|[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+)(?![\w("'])/g;
export const NOT_BEFORE_WORD = /[\w."'/#=-]/;
export const NOT_BEFORE_CALL = /[\w.:]/;

// Cuts a sentence at the names a pattern finds. A name does not count when the character before it is one of `before`.
export function cutNames(text: string, pattern: RegExp, before: RegExp): { text: string; name: boolean }[] {
  const parts: { text: string; name: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    if (at > 0 && before.test(text[at - 1])) continue;
    if (at > last) parts.push({ text: text.slice(last, at), name: false });
    parts.push({ text: match[0], name: true });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), name: false });
  return parts;
}

// A type as text, cut where a name starts and ends. A name before a colon is a parameter, not a type.
export function typeParts(text: string): { text: string; name: boolean }[] {
  const parts: { text: string; name: boolean }[] = [];
  const pattern = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_]\w*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    const word = match[0];
    const isName = /^[A-Za-z_]/.test(word) && !/^\??:/.test(text.slice(at + word.length));
    if (!isName) continue;
    if (at > last) parts.push({ text: text.slice(last, at), name: false });
    parts.push({ text: word, name: true });
    last = at + word.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), name: false });
  return parts;
}

export type LuaToken = { text: string; kind: 'keyword' | 'string' | 'number' | 'comment' | 'plain' };
const LUA =
  /(--[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(and|break|do|else|elseif|end|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b|\b(\d+(?:\.\d+)?)\b/g;

export function luaTokens(code: string): LuaToken[] {
  const tokens: LuaToken[] = [];
  let last = 0;
  for (const match of code.matchAll(LUA)) {
    if (match.index > last) tokens.push({ text: code.slice(last, match.index), kind: 'plain' });
    tokens.push({ text: match[0], kind: match[1] ? 'comment' : match[2] ? 'string' : match[3] ? 'keyword' : 'number' });
    last = match.index + match[0].length;
  }
  if (last < code.length) tokens.push({ text: code.slice(last), kind: 'plain' });
  return tokens;
}

// Where a script gets an Instance of a class: a member of `game`, or game:Find when there is none.
export type Receiver = { via: string; name: string; optional: boolean };

const ENTRY_POINTS: [member: string, type: string, name: string, optional: boolean][] = [
  ['Character', 'IcarusPlayerCharacter', 'character', true],
  ['LocalPlayer', 'IcarusPlayerController', 'player', false],
  ['World', 'World', 'world', false],
  ['GameState', 'IcarusGameStateBase', 'state', false],
  ['GameMode', 'IcarusGameModeBase', 'mode', true],
  ['GameInstance', 'BP_IcarusGameInstance_C', 'gameInstance', false],
  ['Engine', 'IcarusGameEngine', 'engine', false],
  ['Viewport', 'IcarusGameViewportClient', 'viewport', false],
];

// The members of `game` by the class each one is. Wax's own definitions say which class when they name one.
export function receivers(wax: WaxIndex, game: GameIndex): { index: number; receiver: Receiver }[] {
  const props = wax.types.get('game')?.props ?? [];
  const found: { index: number; receiver: Receiver }[] = [];
  for (const [member, fallback, name, optional] of ENTRY_POINTS) {
    const declared = props.find((prop) => prop.name === member)?.type ?? '';
    const index = game.find(declared.replace(/\?$/, '')) ?? game.find(fallback);
    if (index === undefined) continue;
    found.push({ index, receiver: { via: `game.${member}`, name, optional: declared ? declared.endsWith('?') : optional } });
  }
  return found;
}

export function receiverFor(list: { index: number; receiver: Receiver }[], game: GameIndex, index: number): Receiver | null {
  return list.find((entry) => entry.index === index || game.ancestors(entry.index).includes(index))?.receiver ?? null;
}

// How a script gets an Instance of a class: where it comes from, the name it then has, and whether it can be nil.
export function reach(receiver: Receiver | null, className: string): { name: string; source: string; guarded: boolean } {
  if (receiver) return { name: receiver.name, source: receiver.via, guarded: receiver.optional };
  return { name: 'found', source: `game:Find(${JSON.stringify(className)})`, guarded: true };
}

// A function library has no objects in the world. Its functions are called on the object the engine keeps for the class.
export const isLibrary = (game: GameIndex, index: number) =>
  game.kind(index) === 'c' && game.ancestors(index).some((at) => game.name(at) === 'BlueprintFunctionLibrary');

export function libraryLine(type: GameType) {
  return `local library = game:Library(${JSON.stringify(type.name)})`;
}

// The index writes its examples with `obj` for the object. Here the object gets a real source.
// `type` is the type that declares the member, `className` the class the page is about.
export function gameUse(example: string, type: GameType, className: string, receiver: Receiver | null, library: boolean): string {
  const through = (name: string) => example.replace(/\bobj\b/, name);
  if (type.kind !== 'class') return example;
  if (library) return `${libraryLine(type)}\n${through('library')}`;
  const { name, source, guarded } = reach(receiver, className);
  if (!guarded) return through(source);
  return `local ${name} = ${source}\nif ${name} then\n    ${through(name)}\nend`;
}

export type Hit = {
  source: Source;
  kind: Kind;
  // What to open: a Wax id, or a game type's key with ".Member" after it.
  id: string;
  label: string;
  detail: string;
  // For a game entry: the type it belongs to or is built on, said as "In Actor." or "Built on Actor."
  link?: { lead: string; id: string; label: string };
  tag: string;
};

type Candidate = { rank: number; source: 0 | 1; order: number; sort: string; size: number; hits: () => Hit[] };
// Among equal matches a type comes before a function, and a function before a property.
const ORDER: Record<Kind, number> = { class: 0, enum: 0, function: 1, event: 2, property: 3 };

const startsWord = (text: string, at: number) =>
  at === 0 || /[^A-Za-z0-9]/.test(text[at - 1]) || (/[A-Z]/.test(text[at]) && /[a-z0-9]/.test(text[at - 1]));

// 0 the name itself, 1 starts with it, 2 a word in the name starts with it, 3 has it, 4 has every typed word. -1 no match.
export function rankOf(typed: string, words: string[], name: string, lower = name.toLowerCase()): number {
  if (typed === '') return 0;
  let at = lower.indexOf(typed);
  if (at === -1) return words.length > 1 && words.every((word) => lower.includes(word)) ? 4 : -1;
  if (at === 0) return lower.length === typed.length ? 0 : 1;
  for (; at !== -1; at = lower.indexOf(typed, at + 1)) if (startsWord(name, at)) return 2;
  return 3;
}

const WAX_TAGS: Record<WaxKind, string> = {
  namespace: 'library',
  object: 'class',
  data: 'table',
  alias: 'values',
  globals: 'library',
  blocked: 'blocked',
};
export const waxTag = (type: WaxType) => WAX_TAGS[type.kind];
export const GAME_TAGS = { c: 'class', s: 'structure', e: 'enum' } as const;

export const signature = (row: WaxFunc) =>
  `${row.call}(${(row.params ?? []).map((param) => `${param.name}${param.optional ? '?' : ''}`).join(', ')})`;

type WaxItem = { names: string[]; lowers: string[]; hit: Hit };

export class Searcher {
  private waxItems: WaxItem[] = [];
  private gameLower: string[] | null = null;
  private memberNames: Record<'p' | 'f' | 'e', { names: string[]; lowers: string[] }> | null = null;

  constructor(
    wax: WaxIndex,
    private game: GameIndex | null,
    private members: GameMembers | null,
  ) {
    const item = (names: string[], hit: Hit) => this.waxItems.push({ names, lowers: names.map((name) => name.toLowerCase()), hit });
    for (const type of wax.data.types) {
      const last = type.title.slice(type.title.lastIndexOf('.') + 1);
      item([type.title, last, type.name, type.name.replace(/^Wax/, '')], {
        source: 'wax',
        kind: type.kind === 'alias' ? 'enum' : 'class',
        id: type.id,
        label: type.title,
        detail: firstSentence(type.text ?? ''),
        tag: waxTag(type),
      });
      const member = (kind: Kind, tag: string, row: WaxProp | WaxSignal | WaxFunc, said: string, label = said) =>
        item([row.name, said, row.id], { source: 'wax', kind, id: row.id, label, detail: firstSentence(row.text ?? ''), tag });
      const owner = type.kind === 'globals' ? '' : `${type.title}.`;
      for (const row of type.props ?? []) if (!wax.types.has(row.id) && !row.name.startsWith('[')) member('property', 'property', row, `${owner}${row.name}`);
      for (const row of type.signals ?? []) member('event', 'signal', row, `${owner}${row.name}`);
      for (const row of type.funcs ?? []) member('function', row.blocked ? 'blocked' : 'function', row, row.call, signature(row));
    }
    if (members) {
      const list = (group: 'p' | 'f' | 'e') => {
        const names = Object.keys(members[group]);
        return { names, lowers: names.map((name) => name.toLowerCase()) };
      };
      this.memberNames = { p: list('p'), f: list('f'), e: list('e') };
    }
  }

  find(text: string, kind: Kind | '', source: Source | '', limit: number): { total: number; hits: Hit[] } {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const typed = words.join('');
    const found: Candidate[] = [];

    if (source !== 'game') {
      for (const entry of this.waxItems) {
        if (kind && entry.hit.kind !== kind) continue;
        let best = -1;
        let matched = entry.lowers[0];
        for (let i = 0; i < entry.names.length; i++) {
          const rank = rankOf(typed, words, entry.names[i], entry.lowers[i]);
          if (rank === -1 || (best !== -1 && rank >= best)) continue;
          best = rank;
          matched = entry.lowers[i];
        }
        if (best !== -1) found.push({ rank: best, source: 0, order: ORDER[entry.hit.kind], sort: typed ? matched : entry.lowers[0], size: 1, hits: () => [entry.hit] });
      }
    }

    const game = this.game;
    if (game && source !== 'wax') {
      const lower = (this.gameLower ??= game.search.types.map(([name]) => name.toLowerCase()));
      // "actor.k2" looks for members of types named like "actor".
      const cut = Math.max(typed.lastIndexOf('.'), typed.lastIndexOf(':'));
      const ownerPart = cut > 0 ? typed.slice(0, cut) : '';
      const memberPart = cut > 0 ? typed.slice(cut + 1) : typed;

      if (!ownerPart && (!kind || kind === 'class' || kind === 'enum')) {
        for (let index = 0; index < game.size; index++) {
          const letter = game.kind(index);
          if (kind && (kind === 'enum') !== (letter === 'e')) continue;
          const rank = rankOf(typed, words, game.name(index), lower[index]);
          if (rank === -1) continue;
          found.push({
            rank,
            source: 1,
            order: 0,
            sort: lower[index],
            size: 1,
            hits: () => {
              const parent = game.parent(index);
              const link = parent >= 0 ? { lead: 'Built on', id: game.key(parent), label: game.name(parent) } : undefined;
              return [{ source: 'game', kind: letter === 'e' ? 'enum' : 'class', id: game.key(index), label: game.name(index), detail: '', link, tag: GAME_TAGS[letter] }];
            },
          });
        }
      }

      const groups: ['p' | 'f' | 'e', Kind, string][] = [
        ['f', 'function', 'function'],
        ['e', 'event', 'delegate'],
        ['p', 'property', 'property'],
      ];
      for (const [group, memberKind, tag] of groups) {
        if (!this.memberNames || !this.members || (kind && kind !== memberKind)) continue;
        const { names, lowers } = this.memberNames[group];
        const owners = this.members[group];
        for (let i = 0; i < names.length; i++) {
          const rank = rankOf(memberPart, ownerPart ? [memberPart] : words, names[i], lowers[i]);
          if (rank === -1) continue;
          const name = names[i];
          const on = ownerPart ? owners[name].filter((index) => lower[index].includes(ownerPart)) : owners[name];
          if (on.length === 0) continue;
          found.push({
            rank,
            source: 1,
            order: ORDER[memberKind],
            sort: lowers[i],
            size: on.length,
            hits: () =>
              [...on]
                .sort((a, b) => game.depth(a) - game.depth(b) || lower[a].localeCompare(lower[b]))
                .map((index) => ({
                  source: 'game',
                  kind: memberKind,
                  id: `${game.key(index)}.${name}`,
                  label: name,
                  detail: '',
                  link: { lead: 'In', id: game.key(index), label: game.name(index) },
                  tag,
                })),
          });
        }
      }
    }

    // Shorter names first while searching: they are the closer match. A plain listing is in name order.
    const short = typed === '' ? 0 : 1;
    found.sort(
      (a, b) =>
        a.rank - b.rank ||
        a.source - b.source ||
        short * (a.order - b.order) ||
        short * (a.sort.length - b.sort.length) ||
        (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0),
    );
    const hits: Hit[] = [];
    let total = 0;
    for (const candidate of found) {
      total += candidate.size;
      if (hits.length < limit) hits.push(...candidate.hits().slice(0, limit - hits.length));
    }
    return { total, hits };
  }
}
