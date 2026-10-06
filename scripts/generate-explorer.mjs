#!/usr/bin/env node
// Copies the index of the game's classes into public/explorer-data/ for the Explorer page, and writes two lists
// the page needs beside it: tree.json (each type's parent) and members.json (member names, by kind).
// The index is made by `python scripts\gameindex.py site` in the Wax workspace. Without it the committed copies are kept.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, '..');
const SOURCE = process.env.GAME_INDEX_DIR
  ? path.resolve(process.env.GAME_INDEX_DIR)
  : path.resolve(DOCS, '..', 'build', 'game-index', 'site');
const OUT = path.join(DOCS, 'public', 'explorer-data');
const FORMAT = 1;
const KINDS = { class: 'c', struct: 's', enum: 'e' };
const BUILT_IN = new Set(['integer', 'number', 'boolean', 'string', 'table', 'any', 'nil', 'delegate', 'WaxInstance']);
const LUA_KEYWORDS = new Set(
  'and break do else elseif end false for function goto if in local nil not or repeat return then true until while'.split(' '),
);

function fail(message) {
  console.error(`[generate-explorer] ${message}`);
  process.exit(1);
}

if (!['manifest.json', 'search.json'].every((name) => fs.existsSync(path.join(SOURCE, name)))) {
  console.log(`[generate-explorer] ${path.relative(DOCS, SOURCE)} has no game index: keeping the copy that is already here.`);
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(path.join(SOURCE, 'manifest.json'), 'utf8'));
if (manifest.format !== FORMAT) fail(`the index is format ${manifest.format}, and this script reads format ${FORMAT}.`);
const searchText = fs.readFileSync(path.join(SOURCE, 'search.json'));
const search = JSON.parse(searchText);
if (search.chunks.length !== manifest.chunks.length) fail('search.json and manifest.json list different chunks.');

const outputs = new Map([['search.json', searchText]]);
const types = [];
manifest.chunks.forEach((chunk, number) => {
  if (chunk.id !== search.chunks[number] || /[\\/]/.test(chunk.id)) fail(`chunk ${number} is "${chunk.id}", which is not what search.json lists.`);
  const text = fs.readFileSync(path.join(SOURCE, 'chunks', `${chunk.id}.json`));
  outputs.set(`chunks/${chunk.id}.json`, text);
  for (const type of JSON.parse(text).types) types.push(type);
});
if (types.length !== search.types.length) fail(`the chunks hold ${types.length} types and search.json lists ${search.types.length}.`);
types.forEach((type, index) => {
  const [name, , kind] = search.types[index];
  if (type.name !== name || KINDS[type.kind] !== kind) fail(`type ${index} is ${type.name} in its chunk and ${name} in search.json.`);
  if (type.name.includes('.')) fail(`${type.name} has a dot in its name, which the page's addresses cannot hold.`);
});

// The name a type goes by where another type mentions it: letters, digits and underscores only.
function identifier(name) {
  const text = name.replace(/[^0-9A-Za-z_]/g, '_');
  return text === '' || /^\d/.test(text) || LUA_KEYWORDS.has(text) ? `_${text}` : text;
}
const isNative = (type) => type.from.startsWith('/Script/');
function folders(type) {
  const parts = type.from.slice(0, type.from.lastIndexOf('.')).split('/').filter(Boolean).map(identifier);
  return isNative(type) ? parts.slice(1) : parts.slice(0, -1);
}

// Two types may share a name. The first keeps it; the others are told apart by their folder, as the editor does.
const order = ['class', 'struct', 'enum'];
const named = new Map();
types.forEach((type, index) => {
  const base = identifier(type.name);
  named.set(base, [...(named.get(base) ?? []), index]);
});
const keys = {};
const aliases = {};
const taken = new Set(named.keys());
for (const [base, indexes] of named) {
  indexes.sort((a, b) => {
    const [x, y] = [types[a], types[b]];
    return order.indexOf(x.kind) - order.indexOf(y.kind) || Number(isNative(y)) - Number(isNative(x)) || (x.from < y.from ? -1 : 1);
  });
  if (base !== types[indexes[0]].name) aliases[base] = indexes[0];
  for (const index of indexes.slice(1)) {
    const parts = folders(types[index]);
    let key = base;
    for (let depth = 1; taken.has(key); depth++) key = depth <= parts.length ? `${base}__${parts.slice(-depth).join('_')}` : `${base}__${depth}`;
    taken.add(key);
    keys[index] = key;
    aliases[key] = index;
  }
}
const lookup = (name) => (named.has(name) ? named.get(name)[0] : aliases[name]);

// A parent is given by its bare name. It is looked for among types of the same kind.
const parents = types.map((type) => {
  if (!type.parent) return -1;
  const found = (named.get(identifier(type.parent)) ?? []).filter((index) => types[index].kind === type.kind && types[index].name === type.parent);
  if (found.length === 0) fail(`${type.name} names ${type.parent} as its parent, and the index has no such ${type.kind}.`);
  return found[0];
});

// Member names for the search box: properties, functions, and delegates (the game's own events).
const members = { p: {}, f: {}, e: {} };
const unknown = new Map();
const add = (group, name, index) => (members[group][name] ??= []).push(index);
function mentioned(text) {
  for (const [word] of text.replace(/\w+\??:/g, '').matchAll(/[A-Za-z_]\w*/g)) {
    if (!BUILT_IN.has(word) && lookup(word) === undefined) unknown.set(word, (unknown.get(word) ?? 0) + 1);
  }
}
types.forEach((type, index) => {
  for (const [name, text] of type.props ?? []) {
    add(text.startsWith('delegate(') ? 'e' : 'p', name, index);
    mentioned(text);
  }
  for (const [name, params, returns] of type.funcs ?? []) {
    add('f', name, index);
    for (const [, text] of params) mentioned(text);
    if (returns) mentioned(returns);
  }
});
const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const count = (group) => Object.values(members[group]).reduce((sum, list) => sum + list.length, 0);

outputs.set(
  'tree.json',
  Buffer.from(
    `${JSON.stringify({
      format: FORMAT,
      taken: manifest.source?.written ?? '',
      counts: { ...manifest.counts, properties: count('p'), functions: count('f'), events: count('e') },
      parents,
      keys,
      aliases: sorted(aliases),
    })}\n`,
  ),
);
outputs.set('members.json', Buffer.from(`${JSON.stringify({ p: sorted(members.p), f: sorted(members.f), e: sorted(members.e) })}\n`));

// A file is only written when it changes. Chunks an earlier index left behind are removed.
let written = 0;
for (const [name, content] of outputs) {
  const file = path.join(OUT, name);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(content)) continue;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  written++;
}
let removed = 0;
for (const name of fs.existsSync(path.join(OUT, 'chunks')) ? fs.readdirSync(path.join(OUT, 'chunks')) : []) {
  if (!name.endsWith('.json') || outputs.has(`chunks/${name}`)) continue;
  fs.rmSync(path.join(OUT, 'chunks', name));
  removed++;
}

const size = (pick) => [...outputs].filter(([name]) => pick(name)).reduce((sum, [, content]) => sum + content.length, 0);
const kb = (bytes) => `${Math.round(bytes / 1024).toLocaleString('en-US')} KB`;
console.log(
  `[generate-explorer] ${types.length} types in ${manifest.chunks.length} chunks (${kb(size((name) => name.startsWith('chunks/')))}), ` +
    `search.json ${kb(size((name) => name === 'search.json'))}, tree.json ${kb(size((name) => name === 'tree.json'))}, ` +
    `members.json ${kb(size((name) => name === 'members.json'))}. ${written} file(s) changed${removed ? `, ${removed} removed` : ''}.`,
);
if (unknown.size) {
  const list = [...unknown].map(([name, times]) => `${name} (${times})`).join(', ');
  console.log(`[generate-explorer] ${unknown.size} type name(s) are mentioned and are not in the index, so the page cannot link them: ${list}`);
}
