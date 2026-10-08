'use client';
import { ArrowLeft, Check, ChevronRight, Copy } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  createContext,
  Fragment,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FilterInput } from '@/components/filter-input';
import { NEXT_IS_OUT, NEXT_SENTENCE, NextMark } from '@/components/next-version';
import { copy } from '@/lib/copy';
import {
  cutNames,
  delegateParams,
  firstSentence,
  GAME_TAGS,
  GameIndex,
  type GameMembers,
  type GameSearch,
  type GameTree,
  type GameType,
  gameUse,
  type Guide,
  type Hit,
  isDelegate,
  isLibrary,
  libraryLine,
  type Kind,
  KINDS,
  luaTokens,
  namedList,
  NOT_BEFORE_CALL,
  NOT_BEFORE_WORD,
  PROSE_WORD,
  reach,
  type Receiver,
  receiverFor,
  receivers,
  Searcher,
  type Source,
  SOURCES,
  typeParts,
  type WaxData,
  type WaxFunc,
  WaxIndex,
  type WaxProp,
  type WaxSignal,
  type WaxType,
  waxTag,
} from '@/lib/explorer';
import waxData from '@/lib/explorer-wax.json';
import { appName, explorerBuildsUrl, explorerDataUrl, explorerStamp } from '@/lib/shared';

const wax = new WaxIndex(waxData as unknown as WaxData);

type Open = { source: Source; id: string };
type Query = { q: string; kind: Kind | ''; source: Source | ''; open: Open | null };
type Loaded = GameType | 'loading' | 'failed';

const PAGE = 100;
const SHOWN = 12;
const LINK = 'text-fd-primary underline underline-offset-4';
const NAME = 'text-fd-primary underline-offset-4 hover:underline';
const BUTTON =
  'rounded-lg border bg-fd-card px-3 py-1.5 text-sm font-medium transition-colors outline-none hover:bg-fd-accent focus-visible:ring-2 focus-visible:ring-fd-ring disabled:pointer-events-none disabled:opacity-40';
const CODE = 'rounded-md border bg-fd-background px-1 py-0.5 font-mono text-[0.85em]';
const LIST = 'overflow-hidden rounded-xl border bg-fd-card';
const SOURCE = "The list is made from the game's own files and holds every class in them, whether it is loaded or not.";
const BUILT_IN = new Set(['integer', 'number', 'boolean', 'string', 'table', 'any', 'nil', 'fun', 'self', 'delegate', 'function', 'thread']);
const LUA_COLORS = {
  keyword: 'text-fd-primary',
  string: 'text-emerald-700 dark:text-emerald-400',
  number: 'text-sky-700 dark:text-sky-400',
  comment: 'text-fd-muted-foreground',
  plain: '',
};

function readQuery(search: string): Query {
  const params = new URLSearchParams(search);
  const inWax = params.get('wax');
  const inGame = params.get('game');
  return {
    q: (params.get('q') ?? '').trim().slice(0, 200),
    kind: KINDS.find(([key]) => key === params.get('kind'))?.[0] ?? '',
    source: SOURCES.find(([key]) => key === params.get('from'))?.[0] ?? '',
    open: inWax ? { source: 'wax', id: inWax.slice(0, 300) } : inGame ? { source: 'game', id: inGame.slice(0, 300) } : null,
  };
}

function searchOf(query: Query, open: Open | null = query.open) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.kind) params.set('kind', query.kind);
  if (query.source) params.set('from', query.source);
  if (open) params.set(open.source, open.id);
  const text = params.toString();
  return text ? `?${text}` : '';
}

// Why a file of the data did not come, as a sentence for the page.
class DataProblem extends Error {}
const whyOf = (problem: unknown) => (problem instanceof DataProblem ? problem.message : 'Something went wrong while reading the data.');

// One fetch of one data file. `fresh` goes around the browser's own copy. `fits` says whether the file is the one meant.
async function fetchData<T>(file: string, fits: (data: unknown) => data is T, fresh: boolean, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${explorerDataUrl}/${file}`, { signal, cache: fresh ? 'reload' : 'default' });
  } catch (problem) {
    if (signal?.aborted) throw problem;
    throw new DataProblem(`The connection failed while fetching ${file}.`);
  }
  if (!response.ok) throw new DataProblem(`The site answered ${response.status} for ${file}.`);
  const data: unknown = await response.json().catch(() => undefined);
  if (!fits(data)) throw new DataProblem(`${file} came, and it does not hold what this page expects.`);
  return data;
}

// A file that fails, or is not the one meant, is asked for once more around the browser's own copy before anything is said.
async function getData<T>(file: string, fits: (data: unknown) => data is T, fresh: boolean, signal?: AbortSignal): Promise<T> {
  if (!fresh) {
    try {
      return await fetchData(file, fits, false, signal);
    } catch (problem) {
      if (signal?.aborted) throw problem;
    }
  }
  return fetchData(file, fits, true, signal);
}

const isSearch = (data: unknown): data is GameSearch =>
  typeof data === 'object' && data !== null && Array.isArray((data as GameSearch).types) && Array.isArray((data as GameSearch).chunks);
const isTree = (data: unknown): data is GameTree => typeof data === 'object' && data !== null && Array.isArray((data as GameTree).parents);
const isMembers = (data: unknown): data is GameMembers =>
  typeof data === 'object' && data !== null && ['p', 'f', 'e'].every((group) => typeof (data as GameMembers)[group as 'p'] === 'object');

// True when the site now has other data than this page was built with: the page is older than the site.
async function siteMovedOn(): Promise<boolean> {
  try {
    const response = await fetch(explorerBuildsUrl, { cache: 'no-store' });
    const builds = response.ok ? ((await response.json()) as { current?: string; kept?: string[] }) : null;
    return typeof builds?.current === 'string' && builds.current !== explorerStamp && !(builds.kept ?? []).includes(explorerStamp);
  } catch {
    return false;
  }
}

// A click with a modifier key, or with another button, is left to the browser.
function plain(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const cut = (id: string): [string, string] => (id.includes('.') ? [id.slice(0, id.indexOf('.')), id.slice(id.indexOf('.') + 1)] : [id, '']);
// What a page is about: a type. An address may also name one member of it.
const pageOf = (open: Open) => (open.source === 'wax' ? (wax.open(open.id)?.type.id ?? open.id) : cut(open.id)[0]);

type Shared = {
  game: GameIndex | null;
  entries: { index: number; receiver: Receiver }[];
  hrefOf: (open: Open | null) => string;
  go: (open: Open | null, how?: 'push' | 'replace', scroll?: boolean) => void;
  typeAt: (index: number) => Loaded;
  // Why typeAt said 'failed'.
  whyAt: (index: number) => string;
  want: (index: number) => void;
  // Fetches the list again around the browser's own copy, and after it whatever the page shows.
  startOver: () => void;
  // The site has other data now than this page was built with, and no longer has this page's.
  movedOn: boolean;
  scrollTo: RefObject<string>;
};
const SharedContext = createContext<Shared | null>(null);
function useShared() {
  const shared = useContext(SharedContext);
  if (!shared) throw new Error('The Explorer parts need the Explorer around them.');
  return shared;
}

function EntryLink({ open, className = NAME, children }: { open: Open | null; className?: string; children: ReactNode }) {
  const { hrefOf, go } = useShared();
  return (
    <a
      href={hrefOf(open)}
      className={className}
      onClick={(event) => {
        if (!plain(event)) return;
        event.preventDefault();
        go(open);
      }}
    >
      {children}
    </a>
  );
}

function targetOf(word: string, game: GameIndex | null): Open | null {
  if (BUILT_IN.has(word)) return null;
  const type = wax.byName.get(word);
  if (type) return { source: 'wax', id: type.id };
  const index = game?.find(word);
  return game && index !== undefined ? { source: 'game', id: game.key(index) } : null;
}

// A type as it is written, with every type name in it a link to that type.
function TypeText({ text }: { text: string }) {
  const { game } = useShared();
  return (
    <>
      {typeParts(text).map((part, index) => {
        const open = part.name ? targetOf(part.text, game) : null;
        return open ? (
          <EntryLink key={index} open={open}>
            {part.text}
          </EntryLink>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        );
      })}
    </>
  );
}

// A description. Text in backticks is code, and a function or type it names is a link.
function Prose({ text }: { text: string }) {
  const { game } = useShared();
  const words = (piece: string, key: number) =>
    cutNames(piece, PROSE_WORD, NOT_BEFORE_WORD).map((word, at) => {
      const known = word.name && (wax.byName.has(word.text) || !wax.ownNames.has(word.text));
      const open = known ? targetOf(word.text, game) : null;
      return open ? (
        <EntryLink key={`${key}.${at}`} open={open}>
          {word.text}
        </EntryLink>
      ) : (
        <Fragment key={`${key}.${at}`}>{word.text}</Fragment>
      );
    });
  const linked = (part: string) =>
    (wax.spoken ? cutNames(part, wax.spoken, NOT_BEFORE_CALL) : [{ text: part, name: false }]).map((piece, index) =>
      piece.name ? (
        <EntryLink key={index} open={{ source: 'wax', id: wax.data.spoken[piece.text] }}>
          {piece.text}
        </EntryLink>
      ) : (
        words(piece.text, index)
      ),
    );
  return (
    <>
      {text.split(/(`[^`]*`)/).map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className={CODE}>
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={index}>{linked(part)}</Fragment>
        ),
      )}
    </>
  );
}

function Tag({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
        strong ? 'border-fd-primary/40 text-fd-primary' : 'text-fd-muted-foreground'
      }`}
    >
      {children}
    </span>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-fd-ring ${
        on
          ? 'border-fd-primary bg-fd-primary/10 text-fd-primary'
          : 'bg-fd-card text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function Notice({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-fd-card p-6">
      <p>{text}</p>
      {action && onAction ? (
        <button type="button" onClick={onAction} className={BUTTON}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

// Something of the game's data did not come, after a second try. `what` names it, `why` is the reason found.
function LoadProblem({ what, why, rest }: { what: string; why: string; rest?: string }) {
  const { startOver, movedOn } = useShared();
  if (movedOn) {
    return (
      <Notice
        text={`${what} could not be loaded: the site was updated after this page was opened, and it no longer has the data this page reads. Reload the page to get the new one.`}
        action="Reload the page"
        onAction={() => window.location.reload()}
      />
    );
  }
  return (
    <Notice
      text={`${what} could not be loaded. ${why}${rest ? ` ${rest}` : ''}`}
      action="Try again"
      onAction={startOver}
    />
  );
}

// Stands where the members of a type will be while they are fetched, shaped like what comes: on a type's own page
// a box where the filter will be, then a heading and a few lines. So nothing above the list moves when it arrives.
function MembersLoading({ name, filter }: { name: string; filter?: boolean }) {
  const widths = ['w-40', 'w-56', 'w-32', 'w-48', 'w-36', 'w-52'];
  const says = `Loading the members of ${name}`;
  return (
    <>
      {filter ? (
        <p role="status" className="flex h-10 max-w-sm items-center truncate rounded-lg border bg-fd-card px-3 text-sm text-fd-muted-foreground">
          {says}
        </p>
      ) : null}
      <section className="flex flex-col gap-3">
        {filter ? (
          <span aria-hidden="true" className="my-1 block h-5 w-28 animate-pulse rounded bg-fd-muted" />
        ) : (
          <h2 role="status" className="text-lg font-medium text-fd-muted-foreground">
            {says}
          </h2>
        )}
        <ul aria-hidden="true" className={LIST}>
          {widths.map((width) => (
            <li key={width} className="border-t py-2.5 pl-[2.125rem] pr-3 first:border-t-0 sm:pl-[2.375rem] sm:pr-4">
              <span className={`my-[0.0625rem] block h-[1.125rem] ${width} max-w-full animate-pulse rounded bg-fd-muted`} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-fd-muted-foreground">{label}</dt>
      <dd className="text-sm [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

// Links in a row. A long list shows its first few until asked for the rest.
function Links({ items }: { items: { open: Open; label: string }[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[13px]">
      {shown.map((item) => (
        <EntryLink key={`${item.open.source}:${item.open.id}`} open={item.open}>
          {item.label}
        </EntryLink>
      ))}
      {items.length > SHOWN ? (
        <button type="button" onClick={() => setAll(!all)} className={`font-sans text-sm ${LINK}`}>
          {all ? 'Show fewer' : `Show all ${items.length.toLocaleString('en-US')}`}
        </button>
      ) : null}
    </span>
  );
}

function Code({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="relative rounded-lg border bg-fd-background">
      <pre className="overflow-x-auto p-3 pr-11 font-mono text-[13px] leading-relaxed">
        <code>
          {luaTokens(code).map((token, index) => (
            <span key={index} className={LUA_COLORS[token.kind]}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
      <button
        type="button"
        aria-label={copied ? 'Copied' : 'Copy the code'}
        onClick={async () => {
          setCopied(await copy(code));
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        }}
        className="absolute right-1.5 top-1.5 rounded-md bg-fd-background p-1.5 text-fd-muted-foreground transition-colors outline-none hover:bg-fd-accent hover:text-fd-foreground focus-visible:ring-2 focus-visible:ring-fd-ring"
      >
        {copied ? <Check aria-hidden="true" className="size-4 text-fd-primary" /> : <Copy aria-hidden="true" className="size-4" />}
      </button>
    </div>
  );
}

function InScript({ code, note }: { code: string; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-fd-muted-foreground">In a script</h3>
      <Code code={code} />
      {note ? <p className="text-sm text-fd-muted-foreground">{note}</p> : null}
    </div>
  );
}

// A signature as text, one form per line, with its type names linked.
function Shape({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-fd-background p-3 font-mono text-[13px] leading-relaxed [overflow-wrap:anywhere]">
      {lines.map((line, index) => {
        // What comes before the bracket is the function's own name, never a type.
        const at = line.indexOf('(');
        return (
          <div key={index}>
            {line.slice(0, Math.max(at, 0))}
            <TypeText text={line.slice(Math.max(at, 0))} />
          </div>
        );
      })}
    </div>
  );
}

type Part = { name: string; type: string; optional?: boolean; text?: string; next?: boolean };

function Parts({ title, parts }: { title: string; parts: Part[] }) {
  // Values without a name, such as what a function returns, need no column for names.
  const named = parts.some((part) => part.name !== '');
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-fd-muted-foreground">{title}</h3>
      <dl className="flex flex-col gap-2">
        {parts.map((part, index) => (
          <div
            key={`${part.name}.${index}`}
            className={`grid grid-cols-1 gap-x-4 gap-y-0.5 ${named ? 'sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]' : ''}`}
          >
            <dt className={`font-mono text-[13px] [overflow-wrap:anywhere] ${named ? '' : 'sr-only'}`}>
              {part.name || `Value ${index + 1}`}
              {part.optional ? <span className="ml-2 font-sans text-xs text-fd-muted-foreground">optional</span> : null}
              {part.next ? (
                <span className="ml-2">
                  <NextMark />
                </span>
              ) : null}
            </dt>
            <dd className="flex min-w-0 flex-col gap-0.5 text-sm">
              <span className="font-mono text-[13px] [overflow-wrap:anywhere]">
                <TypeText text={part.type} />
              </span>
              {part.text ? (
                <span className="text-fd-muted-foreground">
                  <Prose text={part.text} />
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DocLinks({ reference, guide }: { reference?: string; guide?: Guide }) {
  if (!reference && !guide) return null;
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {guide ? (
        <Link href={guide.href} className={LINK}>
          Guide: {guide.title}
        </Link>
      ) : null}
      {reference ? (
        <Link href={reference} className={LINK}>
          Reference page
        </Link>
      ) : null}
    </p>
  );
}

// One member. Its name opens and closes what is known about it.
function Row(props: {
  id: string;
  source: Source;
  head: ReactNode;
  side?: ReactNode;
  tags?: string[];
  next?: boolean;
  summary?: string;
  open: boolean;
  marked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { scrollTo } = useShared();
  const element = useRef<HTMLLIElement>(null);
  // An address that names this member brings it into view once.
  useEffect(() => {
    if (scrollTo.current !== `${props.source}:${props.id}` || !element.current) return;
    scrollTo.current = '';
    element.current.scrollIntoView({ block: 'start' });
  });
  return (
    <li
      ref={element}
      id={encodeURIComponent(props.id)}
      className={`scroll-mt-20 border-t first:border-t-0 ${props.marked ? 'bg-fd-accent/50' : ''}`}
    >
      <div className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 pl-[2.125rem] pr-3 sm:pl-[2.375rem] sm:pr-4">
        <button
          type="button"
          aria-expanded={props.open}
          onClick={props.onToggle}
          className="group min-w-0 rounded-md text-left font-mono text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
        >
          <ChevronRight
            aria-hidden="true"
            className={`absolute left-3 top-[0.8rem] size-3.5 text-fd-muted-foreground transition-transform sm:left-4 ${props.open ? 'rotate-90' : ''}`}
          />
          <span className="[overflow-wrap:anywhere] group-hover:text-fd-primary">{props.head}</span>
        </button>
        {props.side ? <span className="min-w-0 font-mono text-[13px] text-fd-muted-foreground [overflow-wrap:anywhere]">{props.side}</span> : null}
        {props.tags?.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
        {props.next ? <NextMark /> : null}
      </div>
      {!props.open && props.summary ? (
        <p className="-mt-1.5 line-clamp-1 px-3 pb-2.5 pl-[2.125rem] text-sm text-fd-muted-foreground sm:px-4 sm:pl-[2.375rem]">
          <Prose text={props.summary} />
        </p>
      ) : null}
      {props.open ? (
        <div className="flex flex-col gap-4 px-3 pb-4 pl-[2.125rem] sm:px-4 sm:pl-[2.375rem]">
          {props.next && !NEXT_IS_OUT ? <p className="text-sm text-fd-muted-foreground">{NEXT_SENTENCE}</p> : null}
          {props.children}
        </div>
      ) : null}
    </li>
  );
}

// A line of a list that opens an entry. The name is the link and covers the line. Links in the text under it stay their own.
function ListRow({ open, label, side, indent, children }: { open: Open; label: string; side?: ReactNode; indent?: boolean; children?: ReactNode }) {
  return (
    <li className="relative border-t transition-colors first:border-t-0 hover:bg-fd-accent/60 has-[a:focus-visible]:bg-fd-accent/60">
      <div className={`flex flex-col gap-0.5 px-3 py-2.5 sm:px-4 ${indent ? 'pl-9 sm:pl-10' : ''}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <EntryLink open={open} className="min-w-0 font-mono text-[13px] font-medium outline-none [overflow-wrap:anywhere] after:absolute after:inset-0">
            {label}
          </EntryLink>
          {side}
        </div>
        {children ? <div className="line-clamp-1 text-sm text-fd-muted-foreground [&_a]:relative [&_a]:z-10">{children}</div> : null}
      </div>
    </li>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

// Which members are open on a page, and what the address bar says about it.
function useOpened(source: Source, page: string, focus: string) {
  const { go } = useShared();
  const [opened, setOpened] = useState<Set<string>>(() => new Set(focus ? [focus] : []));
  useEffect(() => {
    if (focus) setOpened((before) => (before.has(focus) ? before : new Set(before).add(focus)));
  }, [focus]);
  // Members that come from another type open in place. Only the page's own members go in the address.
  const toggle = (id: string, own: boolean) => {
    const next = new Set(opened);
    if (next.delete(id)) {
      if (own && focus === id) go({ source, id: page }, 'replace', false);
    } else {
      next.add(id);
      if (own) go({ source, id }, 'replace', false);
    }
    setOpened(next);
  };
  return { opened, toggle };
}

type Rows = { opened: Set<string>; toggle: (id: string, own: boolean) => void; focus: string; own: boolean; filter: string };
const kept = (name: string, filter: string) => filter === '' || name.toLowerCase().includes(filter);

function WaxFunctionRow({ row, type, rows }: { row: WaxFunc; type: WaxType; rows: Rows }) {
  const params = row.params ?? [];
  const returns = row.returns ?? [];
  const typed = params.map((param) => `${param.name}${param.optional ? '?' : ''}: ${param.type}`).join(', ');
  const generics = row.generics?.length ? `<${row.generics.join(', ')}>` : '';
  const result = returns.length ? `: ${returns.map((value) => value.type).join(', ')}` : '';
  return (
    <Row
      id={row.id}
      source="wax"
      head={`${row.name}(${params.map((param) => `${param.name}${param.optional ? '?' : ''}`).join(', ')})`}
      side={returns.length ? <TypeText text={returns.map((value) => value.type).join(', ')} /> : null}
      tags={row.blocked ? ['blocked'] : undefined}
      next={row.next}
      summary={firstSentence(row.text ?? '')}
      open={rows.opened.has(row.id)}
      marked={rows.focus === row.id}
      onToggle={() => rows.toggle(row.id, rows.own)}
    >
      {row.text ? (
        <p className="text-sm">
          <Prose text={row.text} />
        </p>
      ) : null}
      {row.blocked ? null : <Shape lines={[`${row.call}${generics}(${typed})${result}`, ...(row.overloads ?? [])]} />}
      {params.length > 0 && !row.blocked ? <Parts title="Parameters" parts={params} /> : null}
      {row.blocked ? null : returns.length > 0 ? (
        <Parts title="Returns" parts={returns.map((value) => ({ name: value.name ?? '', type: value.type, text: value.text }))} />
      ) : (
        <p className="text-sm text-fd-muted-foreground">Returns nothing.</p>
      )}
      {row.use ? <InScript code={row.use} /> : null}
      <DocLinks reference={row.ref} guide={row.guide ?? (type.kind === 'globals' ? undefined : type.guide)} />
    </Row>
  );
}

function WaxSignalRow({ row, type, rows }: { row: WaxSignal; type: WaxType; rows: Rows }) {
  const receives = row.receives ? namedList(row.receives).map(([name, kind]) => ({ name, type: kind })) : [];
  return (
    <Row
      id={row.id}
      source="wax"
      head={row.name}
      side={row.receives ? <TypeText text={`(${row.receives})`} /> : null}
      next={row.next}
      summary={firstSentence(row.text ?? '')}
      open={rows.opened.has(row.id)}
      marked={rows.focus === row.id}
      onToggle={() => rows.toggle(row.id, rows.own)}
    >
      {row.text ? (
        <p className="text-sm">
          <Prose text={row.text} />
        </p>
      ) : null}
      {row.open ? (
        <p className="text-sm text-fd-muted-foreground">What the handler receives depends on the control.</p>
      ) : receives.length > 0 ? (
        <Parts title="The handler receives" parts={receives} />
      ) : (
        <p className="text-sm text-fd-muted-foreground">The handler receives nothing.</p>
      )}
      {row.use ? <InScript code={row.use} /> : null}
      <DocLinks reference={type.ref} guide={type.guide} />
    </Row>
  );
}

function WaxPropRow({ row, type, rows }: { row: WaxProp; type: WaxType; rows: Rows }) {
  const other = row.name.startsWith('[');
  return (
    <Row
      id={row.id}
      source="wax"
      head={other ? `any other key ${row.name}` : `${row.name}${row.optional ? '?' : ''}`}
      side={<TypeText text={row.type} />}
      next={row.next}
      summary={firstSentence(row.text ?? '')}
      open={rows.opened.has(row.id)}
      marked={rows.focus === row.id}
      onToggle={() => rows.toggle(row.id, rows.own)}
    >
      {row.text ? (
        <p className="text-sm">
          <Prose text={row.text} />
        </p>
      ) : null}
      {row.optional ? <p className="text-sm text-fd-muted-foreground">You may leave it out.</p> : null}
      {row.use ? <InScript code={row.use} /> : null}
      <DocLinks reference={row.ref ?? type.ref} guide={row.guide ?? (type.kind === 'globals' ? undefined : type.guide)} />
    </Row>
  );
}

const PROPS_TITLE: Record<string, string> = { namespace: 'Members', object: 'Properties', globals: 'Values' };

function WaxMembers({ type, rows }: { type: WaxType; rows: Rows }) {
  const props = (type.props ?? []).filter((row) => kept(row.name, rows.filter));
  const signals = (type.signals ?? []).filter((row) => kept(row.name, rows.filter));
  const funcs = (type.funcs ?? []).filter((row) => kept(row.name, rows.filter));
  const options = /(Options|Settings|Query)$/.test(type.name) || (type.parents ?? []).includes('WaxOptions');
  if (props.length + signals.length + funcs.length === 0) {
    return rows.filter ? <p className="text-sm text-fd-muted-foreground">No member has a name like that.</p> : null;
  }
  return (
    <>
      {props.length > 0 ? (
        <Block title={PROPS_TITLE[type.kind] ?? (options ? 'Options' : 'Fields')}>
          <ul className={LIST}>
            {props.map((row) => (
              <WaxPropRow key={row.id} row={row} type={type} rows={rows} />
            ))}
          </ul>
        </Block>
      ) : null}
      {signals.length > 0 ? (
        <Block title="Signals">
          <ul className={LIST}>
            {signals.map((row) => (
              <WaxSignalRow key={row.id} row={row} type={type} rows={rows} />
            ))}
          </ul>
        </Block>
      ) : null}
      {funcs.length > 0 ? (
        <Block title="Functions">
          <ul className={LIST}>
            {funcs.map((row) => (
              <WaxFunctionRow key={row.id} row={row} type={type} rows={rows} />
            ))}
          </ul>
        </Block>
      ) : null}
    </>
  );
}

// The members a type gets from one it is built on. They are fetched and drawn when the part is opened.
function From({ name, open, children }: { name: string; open: Open; children: () => ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={shown}
          aria-label={`Members from ${name}`}
          onClick={() => setShown(!shown)}
          className="flex items-center gap-2 rounded-md text-sm font-medium outline-none hover:text-fd-primary focus-visible:ring-2 focus-visible:ring-fd-ring"
        >
          <ChevronRight aria-hidden="true" className={`size-4 text-fd-muted-foreground transition-transform ${shown ? 'rotate-90' : ''}`} />
          From
        </button>
        <EntryLink open={open} className={`font-mono text-sm ${NAME}`}>
          {name}
        </EntryLink>
      </div>
      {shown ? <div className="flex flex-col gap-6 border-l pl-3 sm:pl-5 [&_h2]:text-base">{children()}</div> : null}
    </div>
  );
}

function Back() {
  return (
    <EntryLink
      open={null}
      className="inline-flex items-center gap-1.5 self-start text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Explorer
    </EntryLink>
  );
}

// `always`: also for a short list, so the box that stood there while the list was fetched does not go away.
function MemberFilter(props: { value: string; onChange: (value: string) => void; total: number; always?: boolean }) {
  const { value, onChange, total } = props;
  if (total <= (props.always ? 0 : 15)) return null;
  return (
    <div className="flex max-w-sm">
      <FilterInput value={value} onChange={onChange} label="Filter the members" placeholder={`Filter ${total.toLocaleString('en-US')} members`} />
    </div>
  );
}

const WAX_KIND: Record<string, string> = {
  namespace: 'A table of functions that every mod has.',
  alias: 'A short name for a fixed set of values.',
};

function WaxEntry({ type, focus }: { type: WaxType; focus: string }) {
  const { game } = useShared();
  const { opened, toggle } = useOpened('wax', type.id, focus);
  const [filter, setFilter] = useState('');
  const rows: Rows = { opened, toggle, focus, own: true, filter: filter.trim().toLowerCase() };
  const total = (type.props?.length ?? 0) + (type.signals?.length ?? 0) + (type.funcs?.length ?? 0);
  const member = (id: string) => ({ open: { source: 'wax' as const, id }, label: (wax.members.get(id)?.row as WaxFunc | undefined)?.call ?? id });
  const parents = (type.parents ?? []).filter((name) => name !== 'WaxOptions');
  const below = [
    ...(wax.children.get(type.name) ?? []).map((child) => ({ open: { source: 'wax' as const, id: child.id }, label: child.title })),
    ...(type.name === 'WaxInstance' && game ? game.roots.map((index) => ({ open: { source: 'game' as const, id: game.key(index) }, label: game.name(index) })) : []),
  ];
  const inherited = wax.ancestors(type).filter((parent) => parent.name !== 'WaxOptions');
  const values = type.values ?? [];

  return (
    <article className="flex flex-col gap-8">
      <Back />
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag strong>Wax</Tag>
          <Tag>{waxTag(type)}</Tag>
          {type.next ? <NextMark /> : null}
        </div>
        <h1 className="font-mono text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-3xl">{type.title}</h1>
        {type.text || WAX_KIND[type.kind] ? (
          <p className="max-w-3xl">
            <Prose text={type.text || WAX_KIND[type.kind]} />
          </p>
        ) : null}
        {type.next && !NEXT_IS_OUT ? <p className="max-w-3xl text-sm text-fd-muted-foreground">{NEXT_SENTENCE}</p> : null}
        <dl className="flex flex-col gap-3">
          {type.kind === 'namespace' ? (
            <Fact label="Type name">
              <span className="font-mono text-[13px]">{type.name}</span>
            </Fact>
          ) : null}
          {parents.length > 0 ? (
            <Fact label="Built on">
              <span className="font-mono text-[13px]">
                <TypeText text={parents.join(', ')} />
              </span>
            </Fact>
          ) : null}
          {below.length > 0 ? (
            <Fact label={type.name === 'WaxInstance' ? 'Built on it: every class of the game' : 'Built on it'}>
              <Links items={below} />
            </Fact>
          ) : null}
          {type.makers?.length ? (
            <Fact label={type.kind === 'object' ? 'You get one from' : 'Returned by'}>
              <Links items={type.makers.map(member)} />
            </Fact>
          ) : null}
          {type.users?.length ? (
            <Fact label="Used by">
              <Links items={type.users.map(member)} />
            </Fact>
          ) : null}
        </dl>
        <DocLinks reference={type.ref} guide={type.guide} />
      </header>

      {type.use ? <InScript code={type.use} /> : null}

      {type.kind === 'alias' ? (
        <Block title="Values">
          {values.length > 0 ? (
            <ul className={LIST}>
              {values.map((value) => (
                <li key={value.value} className="flex flex-col gap-0.5 border-t px-4 py-2.5 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="font-mono text-[13px] [overflow-wrap:anywhere]">
                    <TypeText text={value.value} />
                    {value.next ? (
                      <span className="ml-2">
                        <NextMark />
                      </span>
                    ) : null}
                  </span>
                  {value.text ? <span className="text-sm text-fd-muted-foreground">{value.text}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">
              The same as{' '}
              <span className="font-mono text-[13px]">
                <TypeText text={type.type ?? ''} />
              </span>
              .
            </p>
          )}
        </Block>
      ) : (
        <>
          <MemberFilter value={filter} onChange={setFilter} total={total} />
          <WaxMembers type={type} rows={rows} />
        </>
      )}

      {inherited.length > 0 ? (
        <Block title="From the types it is built on">
          {inherited.map((parent) => (
            <From key={parent.id} name={parent.title} open={{ source: 'wax', id: parent.id }}>
              {() => <WaxMembers type={parent} rows={{ ...rows, own: false, filter: '' }} />}
            </From>
          ))}
        </Block>
      ) : null}
    </article>
  );
}

const FLAG_TAGS: Record<string, string> = {
  static: 'library',
  event: 'blueprint event',
  latent: 'finishes later',
  oversized: 'cannot be called',
  unsure: 'parameters unsure',
};
const FLAG_NOTES: Record<string, string> = {
  static: 'A library function. It is called on the library, not on an object of the game.',
  event: "The game's code declares this function and a blueprint supplies what it does.",
  latent: 'The work goes on after the call returns.',
  oversized: 'This function cannot be called from Lua. Its parameters take more room than a call from Lua has, so Wax refuses the call.',
  unsure: 'The game data gave no parameter list for this function. The one shown is a guess.',
};

// The properties, delegates and functions one game type declares. `view` is the class the page is about.
function GameMemberLists({ index, type, view, rows }: { index: number; type: GameType; view: number; rows: Rows }) {
  const { game, entries } = useShared();
  if (!game) return null;
  const owner = game.key(index);
  const receiver = type.kind === 'class' ? receiverFor(entries, game, view) : null;
  const all = type.props ?? [];
  const props = all.filter(([name, text]) => !isDelegate(text) && kept(name, rows.filter));
  const events = all.filter(([name, text]) => isDelegate(text) && kept(name, rows.filter));
  const funcs = (type.funcs ?? []).filter(([name]) => kept(name, rows.filter));
  const inLibrary = isLibrary(game, index);
  const use = (example: string, library: boolean) => gameUse(example, type, game.name(view), receiver, library || inLibrary);
  const row = (name: string) => {
    const id = `${owner}.${name}`;
    return { id, source: 'game' as const, open: rows.opened.has(id), marked: rows.focus === id, onToggle: () => rows.toggle(id, rows.own) };
  };

  if (type.kind === 'enum') {
    const listed = type.values ?? [];
    const values = listed.length > 0 && /_MAX$/i.test(listed[listed.length - 1][0]) ? listed.slice(0, -1) : listed;
    return (
      <Block title="Values">
        <ul className={LIST}>
          {values.map(([name, value]) => (
            <li key={`${name}.${value}`} className="flex items-baseline justify-between gap-4 border-t px-4 py-2 first:border-t-0">
              <span className="font-mono text-[13px] [overflow-wrap:anywhere]">{name}</span>
              <span className="font-mono text-[13px] text-fd-muted-foreground">{value}</span>
            </li>
          ))}
        </ul>
      </Block>
    );
  }
  if (props.length + events.length + funcs.length === 0) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        {rows.filter ? 'No member has a name like that.' : `${type.name} adds no members of its own.`}
      </p>
    );
  }
  return (
    <>
      {props.length > 0 ? (
        <Block title={type.kind === 'struct' ? 'Fields' : 'Properties'}>
          <ul className={LIST}>
            {props.map(([name, text, example]) => (
              <Row key={name} {...row(name)} head={name} side={<TypeText text={text} />}>
                <InScript
                  code={use(example, false)}
                  note={type.kind === 'struct' ? `Here value is a ${type.name} that a property or a function gave you.` : undefined}
                />
              </Row>
            ))}
          </ul>
        </Block>
      ) : null}
      {events.length > 0 ? (
        <Block title="Delegates">
          <p className="-mt-1 max-w-3xl text-sm text-fd-muted-foreground">
            A delegate is an event of the game. The game calls the functions bound to it. Wax hands a delegate over as
            the engine holds it, and refuses to assign one.
          </p>
          <ul className={LIST}>
            {events.map(([name, text]) => {
              const params = delegateParams(text);
              return (
                <Row key={name} {...row(name)} head={name} side={<TypeText text={text.replace(/^delegate/, '')} />}>
                  {params === null ? (
                    <p className="font-mono text-[13px]">
                      <TypeText text={text} />
                    </p>
                  ) : params.length > 0 ? (
                    <Parts title="The game calls it with" parts={params.map(([part, kind]) => ({ name: part, type: kind }))} />
                  ) : (
                    <p className="text-sm text-fd-muted-foreground">The game calls it with nothing.</p>
                  )}
                </Row>
              );
            })}
          </ul>
        </Block>
      ) : null}
      {funcs.length > 0 ? (
        <Block title="Functions">
          <ul className={LIST}>
            {funcs.map(([name, params, returns, example, flags = []]) => (
              <Row
                key={name}
                {...row(name)}
                head={`${name}(${params.map(([param]) => param).join(', ')})`}
                side={returns ? <TypeText text={returns} /> : null}
                tags={flags.filter((flag) => FLAG_TAGS[flag]).map((flag) => FLAG_TAGS[flag])}
              >
                <Shape lines={[`${type.name}:${name}(${params.map(([param, kind]) => `${param}: ${kind}`).join(', ')})${returns ? `: ${returns}` : ''}`]} />
                {params.length > 0 ? <Parts title="Parameters" parts={params.map(([param, kind]) => ({ name: param, type: kind }))} /> : null}
                {returns ? (
                  <Parts title="Returns" parts={[{ name: '', type: returns }]} />
                ) : (
                  <p className="text-sm text-fd-muted-foreground">Returns nothing.</p>
                )}
                {flags
                  .filter((flag) => FLAG_NOTES[flag])
                  .map((flag) => (
                    <p key={flag} className="text-sm">
                      {FLAG_NOTES[flag]}
                    </p>
                  ))}
                {flags.includes('oversized') ? null : <InScript code={use(example, flags.includes('static'))} />}
              </Row>
            ))}
          </ul>
        </Block>
      ) : null}
    </>
  );
}

function GameLoaded({ index, view, rows }: { index: number; view: number; rows: Rows }) {
  const { game, typeAt, whyAt, want } = useShared();
  useEffect(() => want(index), [want, index]);
  const type = typeAt(index);
  if (!game) return null;
  if (type === 'loading') return <MembersLoading name={game.name(index)} />;
  if (type === 'failed') return <LoadProblem what={`The members of ${game.name(index)}`} why={whyAt(index)} />;
  return <GameMemberLists index={index} type={type} view={view} rows={rows} />;
}

const GAME_KIND = {
  c: 'A class of the game.',
  s: 'A structure of the game: one value with named parts.',
  e: 'A list of named numbers. A property of this type holds one of the numbers.',
};

function GameEntry({ index, member }: { index: number; member: string }) {
  const { game, entries, typeAt, whyAt, want } = useShared();
  const key = game?.key(index) ?? '';
  const focus = member ? `${key}.${member}` : '';
  const { opened, toggle } = useOpened('game', key, focus);
  const [filter, setFilter] = useState('');
  useEffect(() => want(index), [want, index]);
  if (!game) return null;

  const type = typeAt(index);
  const loaded = typeof type === 'object' ? type : null;
  const rows: Rows = { opened, toggle, focus, own: true, filter: filter.trim().toLowerCase() };
  const letter = game.kind(index);
  const name = game.name(index);
  const link = (at: number) => ({ open: { source: 'game' as const, id: game.key(at) }, label: game.name(at) });
  const chain = game.ancestors(index);
  const total = loaded ? (loaded.props?.length ?? 0) + (loaded.funcs?.length ?? 0) : 0;
  const missing =
    loaded && member && ![...(loaded.props ?? []), ...(loaded.funcs ?? [])].some(([memberName]) => memberName === member) ? member : '';
  const library = isLibrary(game, index);
  const got = letter === 'c' && !library ? reach(receiverFor(entries, game, index), name) : null;

  return (
    <article className="flex flex-col gap-8">
      <Back />
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag strong>Game</Tag>
          <Tag>{GAME_TAGS[letter]}</Tag>
          {loaded?.origin ? <Tag>{loaded.origin === 'native' ? 'game code' : 'blueprint'}</Tag> : null}
        </div>
        <h1 className="font-mono text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-3xl">{name}</h1>
        <p className="max-w-3xl">
          {GAME_KIND[letter]}
          {chain.length > 0 ? (
            <>
              {' '}
              It is built on{' '}
              <EntryLink open={link(chain[0]).open} className={`font-mono text-[0.9em] ${NAME}`}>
                {game.name(chain[0])}
              </EntryLink>
              , so it has everything that one has.
            </>
          ) : null}
          {letter === 'c' ? ' In a script it is an Instance.' : null}
        </p>
        <dl className="flex flex-col gap-3">
          {letter === 'c' || chain.length > 0 ? (
            <Fact label="Built on, nearest first">
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[13px]">
                {chain.map((at, position) => (
                  <Fragment key={at}>
                    {position > 0 ? <ChevronRight aria-hidden="true" className="size-3 text-fd-muted-foreground" /> : null}
                    <EntryLink open={link(at).open}>{game.name(at)}</EntryLink>
                  </Fragment>
                ))}
                {letter === 'c' ? (
                  <>
                    {chain.length > 0 ? <ChevronRight aria-hidden="true" className="size-3 text-fd-muted-foreground" /> : null}
                    <EntryLink open={{ source: 'wax', id: 'WaxInstance' }}>WaxInstance</EntryLink>
                  </>
                ) : null}
              </span>
            </Fact>
          ) : null}
          {game.children[index].length > 0 ? (
            <Fact label="Built on it">
              <Links items={game.children[index].map(link)} />
            </Fact>
          ) : null}
          {/* The line is there from the start, so nothing below it moves when the path arrives. */}
          {type !== 'failed' ? (
            <Fact label="Path in the game">
              {loaded ? (
                <span className="font-mono text-[13px]">{loaded.from}</span>
              ) : (
                <span aria-hidden="true" className="my-[0.1875rem] block h-3.5 w-64 max-w-full animate-pulse rounded bg-fd-muted" />
              )}
            </Fact>
          ) : null}
        </dl>
      </header>

      {got ? (
        <InScript
          code={`local ${got.name} = ${got.source}`}
          note={got.source.startsWith('game:Find') ? 'game:Find gives the first one that exists now, or nil when there is none.' : undefined}
        />
      ) : library ? (
        <InScript code={libraryLine({ name })} note="A library has no objects of its own. Its functions are called on the library itself." />
      ) : null}

      {missing ? (
        <Notice text={`${name} has no member named ${missing.slice(0, 80)}. It may come from a class this one is built on.`} />
      ) : null}

      {type === 'loading' ? (
        <MembersLoading name={name} filter={letter !== 'e'} />
      ) : type === 'failed' ? (
        <LoadProblem
          what={`The members of ${name}`}
          why={whyAt(index)}
          rest="What it is built on and what is built on it are shown above, and the links still work."
        />
      ) : (
        <>
          <MemberFilter value={filter} onChange={setFilter} total={type.kind === 'enum' ? 0 : total} always />
          <GameMemberLists index={index} type={type} view={index} rows={rows} />
        </>
      )}

      {letter !== 'e' && (chain.length > 0 || letter === 'c') ? (
        <Block title="From the classes it is built on">
          {chain.map((at) => (
            <From key={at} name={game.name(at)} open={link(at).open}>
              {() => <GameLoaded index={at} view={index} rows={{ ...rows, own: false, filter: '' }} />}
            </From>
          ))}
          {letter === 'c' && wax.byName.has('WaxInstance') ? (
            <From name="WaxInstance" open={{ source: 'wax', id: 'WaxInstance' }}>
              {() => <WaxMembers type={wax.byName.get('WaxInstance') as WaxType} rows={{ ...rows, own: false, filter: '' }} />}
            </From>
          ) : null}
        </Block>
      ) : null}
    </article>
  );
}

function Missing({ name, inGame }: { name: string; inGame: boolean }) {
  const { go } = useShared();
  return (
    <div className="flex flex-col gap-8">
      <Back />
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Nothing by that name</h1>
      <Notice
        text={`The Explorer has no entry named ${name.slice(0, 80)}.${inGame ? ` ${SOURCE}` : ''}`}
        action="Open the Explorer"
        onAction={() => go(null)}
      />
    </div>
  );
}

function Entry({ open, failed, why }: { open: Open; failed: boolean; why: string }) {
  const { game } = useShared();
  if (open.source === 'wax') {
    const found = wax.open(open.id);
    if (!found) return <Missing name={open.id} inGame={false} />;
    return <WaxEntry key={found.type.id} type={found.type} focus={found.member ? open.id : ''} />;
  }
  if (!game) {
    return (
      <div className="flex flex-col gap-8">
        <Back />
        <h1 className="font-mono text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-3xl">{cut(open.id)[0].slice(0, 80)}</h1>
        {failed ? (
          <LoadProblem what="The list of the game's classes" why={why} rest="What Wax itself gives a mod is still in the Explorer." />
        ) : (
          <MembersLoading name={cut(open.id)[0].slice(0, 80)} filter />
        )}
      </div>
    );
  }
  const [key, member] = cut(open.id);
  const index = game.find(key);
  if (index === undefined) return <Missing name={key} inGame />;
  return <GameEntry key={index} index={index} member={member} />;
}

// Tells the page when a link of the site changes the address without loading the page again.
function Address({ onChange }: { onChange: () => void }) {
  const params = useSearchParams();
  useEffect(onChange, [params, onChange]);
  return null;
}

type Nodes = { open: Set<string>; flip: (key: string) => void };

function Twist({ shown, label, onClick }: { shown: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={shown}
      aria-label={label}
      onClick={onClick}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-fd-muted-foreground outline-none transition-colors hover:bg-fd-accent hover:text-fd-foreground focus-visible:ring-2 focus-visible:ring-fd-ring"
    >
      <ChevronRight aria-hidden="true" className={`size-4 transition-transform ${shown ? 'rotate-90' : ''}`} />
    </button>
  );
}

// One class in the tree. What is built on it is drawn when the class is opened.
function TreeNode({ index, nodes }: { index: number; nodes: Nodes }) {
  const { game } = useShared();
  if (!game) return null;
  const children = game.children[index];
  const shown = nodes.open.has(`g:${index}`);
  // A long list shows its first hundred until asked for the rest.
  const long = children.length > PAGE * 1.5;
  const all = !long || nodes.open.has(`all:${index}`);
  const listed = all ? children : children.slice(0, PAGE);
  return (
    <li>
      <div className="flex min-w-0 items-center gap-1">
        {children.length > 0 ? (
          <Twist shown={shown} label={`Classes built on ${game.name(index)}`} onClick={() => nodes.flip(`g:${index}`)} />
        ) : (
          <span className="size-7 shrink-0" />
        )}
        <EntryLink open={{ source: 'game', id: game.key(index) }} className={`min-w-0 py-1 font-mono text-[13px] [overflow-wrap:anywhere] ${NAME}`}>
          {game.name(index)}
        </EntryLink>
        {children.length > 0 ? (
          <span className="shrink-0 pl-1 text-xs text-fd-muted-foreground">{game.descendants(index).toLocaleString('en-US')}</span>
        ) : null}
      </div>
      {shown ? (
        <ul className="ml-3.5 border-l pl-1 sm:pl-2">
          {listed.map((child) => (
            <TreeNode key={child} index={child} nodes={nodes} />
          ))}
          {long ? (
            <li className="py-1 pl-8">
              <button type="button" onClick={() => nodes.flip(`all:${index}`)} className={`text-sm ${LINK}`}>
                {all ? 'Show fewer' : `Show all ${children.length.toLocaleString('en-US')}`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

function WaxBrowse({ nodes }: { nodes: Nodes }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Wax</h2>
      <p className="-mt-1 max-w-2xl text-sm text-fd-muted-foreground">What Wax gives every mod. Open a group to see what is in it.</p>
      <ul className={LIST}>
        {wax.data.groups.map((group) => {
          const shown = nodes.open.has(`w:${group.id}`);
          return (
            <li key={group.id} className="border-t first:border-t-0">
              <button
                type="button"
                aria-expanded={shown}
                onClick={() => nodes.flip(`w:${group.id}`)}
                className="flex w-full items-baseline gap-2 px-3 py-3 text-left outline-none transition-colors hover:bg-fd-accent/60 focus-visible:bg-fd-accent/60 sm:px-4"
              >
                <ChevronRight
                  aria-hidden="true"
                  className={`size-4 shrink-0 translate-y-0.5 text-fd-muted-foreground transition-transform ${shown ? 'rotate-90' : ''}`}
                />
                <span className="flex min-w-0 flex-col gap-x-4 sm:flex-row sm:items-baseline">
                  <span className="w-24 shrink-0 font-mono text-sm font-medium">{group.title}</span>
                  <span className="text-sm text-fd-muted-foreground">{group.text}</span>
                </span>
              </button>
              {shown ? (
                <ul className="border-t">
                  {[
                    ...group.types.map((id) => ({ id, title: wax.types.get(id)?.title ?? id, type: wax.types.get(id) })),
                    ...group.members.map((id) => ({ id, title: id, type: undefined })),
                  ].map((item) => {
                    const text = firstSentence((item.type ? item.type.text : wax.members.get(item.id)?.row.text) ?? '');
                    const next = item.type ? item.type.next : wax.members.get(item.id)?.row.next;
                    return (
                      <ListRow
                        key={item.id}
                        indent
                        open={{ source: 'wax', id: item.id }}
                        label={item.title}
                        side={
                          <span className="flex shrink-0 items-center gap-1.5">
                            {next ? <NextMark /> : null}
                            <Tag>{item.type ? waxTag(item.type) : 'function'}</Tag>
                          </span>
                        }
                      >
                        {text ? <Prose text={text} /> : null}
                      </ListRow>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GameBrowse(props: { nodes: Nodes; failed: boolean; why: string; list: (kind: Kind) => void }) {
  const { game } = useShared();
  const shown = props.nodes.open.has('game');
  const counts = game?.tree.counts;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">The game&apos;s classes</h2>
      <p className="-mt-1 max-w-2xl text-sm text-fd-muted-foreground">
        Every class of the game is an Instance in a script. It has what{' '}
        <EntryLink open={{ source: 'wax', id: 'WaxInstance' }} className={`font-mono text-[13px] ${NAME}`}>
          WaxInstance
        </EntryLink>{' '}
        has, and adds the properties and functions of its own class and of the classes that one is built on. {SOURCE}
      </p>
      {props.failed ? (
        <LoadProblem what="The list of the game's classes" why={props.why} />
      ) : !game ? (
        <div role="status" className="rounded-xl border bg-fd-card p-2 sm:p-3">
          <p className="flex h-7 items-center pl-8 text-sm text-fd-muted-foreground">Loading the game&apos;s classes.</p>
        </div>
      ) : (
        <>
          <ul className="rounded-xl border bg-fd-card p-2 sm:p-3">
            <li>
              <div className="flex min-w-0 items-center gap-1">
                <Twist shown={shown} label="Classes built on WaxInstance" onClick={() => props.nodes.flip('game')} />
                <EntryLink open={{ source: 'wax', id: 'WaxInstance' }} className={`py-1 font-mono text-[13px] ${NAME}`}>
                  WaxInstance
                </EntryLink>
                <span className="pl-1 text-xs text-fd-muted-foreground">{(counts?.classes ?? 0).toLocaleString('en-US')}</span>
              </div>
              {shown ? (
                <ul className="ml-3.5 border-l pl-1 sm:pl-2">
                  {game.roots.map((index) => (
                    <TreeNode key={index} index={index} nodes={props.nodes} />
                  ))}
                </ul>
              ) : null}
            </li>
          </ul>
          <p className="text-sm text-fd-muted-foreground">
            The number after a class says how many classes are built on it. Structures and enums are not in the tree.{' '}
            <button type="button" onClick={() => props.list('class')} className={LINK}>
              List the classes and structures
            </button>{' '}
            or{' '}
            <button type="button" onClick={() => props.list('enum')} className={LINK}>
              list the enums
            </button>
            .
          </p>
        </>
      )}
    </section>
  );
}

function Results({ hits }: { hits: Hit[] }) {
  return (
    <ul className={LIST}>
      {hits.map((hit) => (
        <ListRow
          key={`${hit.source}:${hit.id}`}
          open={{ source: hit.source, id: hit.id }}
          label={hit.label}
          side={
            <span className="flex shrink-0 items-center gap-1.5">
              {hit.next ? <NextMark /> : null}
              <Tag>{hit.tag}</Tag>
              <Tag strong={hit.source === 'wax'}>{hit.source === 'wax' ? 'Wax' : 'Game'}</Tag>
            </span>
          }
        >
          {hit.link ? (
            <>
              {hit.link.lead}{' '}
              <EntryLink open={{ source: 'game', id: hit.link.id }} className={`font-mono text-[13px] ${NAME}`}>
                {hit.link.label}
              </EntryLink>
              .
            </>
          ) : hit.detail ? (
            <Prose text={hit.detail} />
          ) : null}
        </ListRow>
      ))}
    </ul>
  );
}

export function Explorer() {
  const [query, setQuery] = useState<Query | null>(null);
  const [text, setText] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [game, setGame] = useState<GameIndex | null>(null);
  const [gameWhy, setGameWhy] = useState('');
  const [members, setMembers] = useState<GameMembers | null>(null);
  const [membersWhy, setMembersWhy] = useState('');
  const [movedOn, setMovedOn] = useState(false);
  const gameFailed = gameWhy !== '';
  const membersFailed = membersWhy !== '';
  const [limit, setLimit] = useState(PAGE);
  const [openNodes, setOpenNodes] = useState<Set<string>>(() => new Set(['game']));
  const [version, setVersion] = useState(0);
  const chunks = useRef(new Map<number, GameType[] | 'loading' | 'failed'>());
  const chunkWhy = useRef(new Map<number, string>());
  const listScroll = useRef(0);
  const mounted = useRef(false);
  const scrollTo = useRef('');
  const written = useRef<string | null>(null);

  // The address is read when the page opens and when something else changes it: the back button, or a link of the site.
  const read = useCallback(() => {
    const next = readQuery(window.location.search);
    if (searchOf(next) === written.current) return;
    written.current = searchOf(next);
    setQuery(next);
    setText(next.q);
    scrollTo.current = next.open ? `${next.open.source}:${next.open.id}` : '';
  }, []);
  useEffect(() => {
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [read]);

  const change = useCallback((next: Query, how: 'replace' | 'push' = 'replace') => {
    setQuery(next);
    written.current = searchOf(next);
    const url = `${window.location.pathname}${searchOf(next)}`;
    if (how === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }, []);

  // The list follows the search box a moment after the last key.
  useEffect(() => {
    if (!query || query.open || text.trim() === query.q) return;
    const wait = setTimeout(() => {
      setLimit(PAGE);
      change({ ...query, q: text.trim() });
    }, 200);
    return () => clearTimeout(wait);
  }, [text, query, change]);

  // After a failure the page looks once at what data the site has now, to tell an old page from a bad connection.
  const failed = useCallback(() => {
    siteMovedOn().then((moved) => {
      if (moved) setMovedOn(true);
    });
  }, []);

  // The names of the game's types and what each is built on. The members of a type are fetched when it is opened.
  // After "Try again" (attempt above 0) every file is fetched around the browser's own copy.
  const fresh = attempt > 0;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getData('search.json', isSearch, fresh, controller.signal),
      getData('tree.json', isTree, fresh, controller.signal),
    ]).then(
      ([search, tree]) => {
        if (controller.signal.aborted) return;
        if (search.types.length !== tree.parents.length) {
          setGameWhy('search.json and tree.json came, and they do not list the same classes.');
          return failed();
        }
        chunks.current = new Map();
        chunkWhy.current = new Map();
        setGame(new GameIndex(search, tree));
        setGameWhy('');
      },
      (problem) => {
        if (controller.signal.aborted) return;
        setGameWhy(whyOf(problem));
        failed();
      },
    );
    return () => controller.abort();
  }, [attempt, fresh, failed]);

  // Member names are a large list. It is fetched when a search first needs it.
  const needMembers =
    query !== null &&
    !query.open &&
    query.source !== 'wax' &&
    (text.trim() !== '' || query.q !== '' || query.kind === 'function' || query.kind === 'event' || query.kind === 'property');
  useEffect(() => {
    if (!needMembers || members) return;
    const controller = new AbortController();
    getData('members.json', isMembers, fresh, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setMembers(data);
        setMembersWhy('');
      },
      (problem) => {
        if (controller.signal.aborted) return;
        setMembersWhy(whyOf(problem));
        failed();
      },
    );
    return () => controller.abort();
  }, [needMembers, members, attempt, fresh, failed]);

  // A chunk is fetched once. It counts as loaded only when it holds the types the list says it holds, each in its place.
  const want = useCallback(
    (index: number) => {
      if (!game) return;
      const number = game.chunk(index);
      // An answer that comes after the list was fetched again goes to the maps that were dropped.
      const [states, reasons] = [chunks.current, chunkWhy.current];
      if (states.get(number) !== undefined) return;
      states.set(number, 'loading');
      const file = `chunks/${encodeURIComponent(game.search.chunks[number])}.json`;
      const fits = (data: unknown): data is { types: GameType[] } =>
        typeof data === 'object' && data !== null && game.holds(number, (data as { types?: unknown }).types);
      getData(file, fits, fresh)
        .then(
          (data) => {
            states.set(number, data.types);
          },
          (problem) => {
            states.set(number, 'failed');
            reasons.set(number, whyOf(problem));
            failed();
          },
        )
        .then(() => setVersion((n) => n + 1));
    },
    [game, fresh, failed],
  );

  // While the list is being fetched again nothing of it is trusted: the members wait for it, and fail with it.
  const typeAt = useCallback(
    (index: number): Loaded => {
      if (gameFailed) return 'failed';
      const state = game ? chunks.current.get(game.chunk(index)) : undefined;
      if (!game || state === undefined || state === 'loading') return 'loading';
      return state === 'failed' ? 'failed' : state[game.place(index)];
    },
    [game, gameFailed],
  );
  const whyAt = useCallback(
    (index: number) => gameWhy || (game ? chunkWhy.current.get(game.chunk(index)) : undefined) || 'Something went wrong while reading the data.',
    [game, gameWhy],
  );

  // "Try again": the list first, around the browser's own copy, then what the page shows. The old list stays on
  // screen until the new one is here, so the page keeps its head and its links.
  const startOver = useCallback(() => {
    chunks.current = new Map();
    chunkWhy.current = new Map();
    setGameWhy('');
    setMembersWhy('');
    setAttempt((n) => n + 1);
  }, []);

  const go = useCallback(
    (open: Open | null, how: 'push' | 'replace' = 'push', scroll = true) => {
      if (!query) return;
      if (scroll) scrollTo.current = open ? `${open.source}:${open.id}` : '';
      if (how === 'push' && !query.open) listScroll.current = window.scrollY;
      change({ ...query, open }, how);
    },
    [query, change],
  );

  const entries = useMemo(() => (game ? receivers(wax, game) : []), [game]);
  const shared = useMemo<Shared>(
    () => ({
      game,
      entries,
      hrefOf: (open) => (query ? searchOf(query, open) || './' : './'),
      go,
      typeAt,
      whyAt,
      want,
      startOver,
      movedOn,
      scrollTo,
    }),
    // `version` is here so that everything is drawn again when a chunk arrives.
    [game, entries, query, go, typeAt, whyAt, want, startOver, movedOn, version],
  );

  // Opening an entry starts at the top. Going back returns to the place in the list.
  const page = query?.open ? `${query.open.source}:${pageOf(query.open)}` : '';
  useLayoutEffect(() => {
    if (mounted.current) window.scrollTo(0, page ? 0 : listScroll.current);
    mounted.current = true;
  }, [page]);

  const shownName = !query?.open
    ? ''
    : query.open.source === 'wax'
      ? (wax.open(query.open.id)?.type.title ?? '')
      : game && game.find(cut(query.open.id)[0]) !== undefined
        ? cut(query.open.id)[0]
        : '';
  // The page's own title is put back by the framework once, a moment after the first draw, so the name is kept in place.
  useEffect(() => {
    if (!shownName) return;
    const before = document.title;
    const wanted = `${shownName} | ${appName}`;
    const apply = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = before;
    };
  }, [shownName]);

  const searcher = useMemo(() => new Searcher(wax, game, members), [game, members]);
  const searching = query !== null && (query.q !== '' || query.kind !== '');
  const result = useMemo(
    () => (query && searching ? searcher.find(query.q, query.kind, query.source, limit) : null),
    [searcher, query, searching, limit],
  );

  const nodes: Nodes = {
    open: openNodes,
    flip: (key) => {
      const next = new Set(openNodes);
      if (!next.delete(key)) next.add(key);
      setOpenNodes(next);
    },
  };
  const set = (patch: Partial<Query>) => {
    if (!query) return;
    setLimit(PAGE);
    change({ ...query, ...patch });
  };
  const showAll = () => {
    setText('');
    set({ q: '', kind: '', source: '' });
  };

  const watcher = (
    <Suspense fallback={null}>
      <Address onChange={read} />
    </Suspense>
  );
  if (query?.open) {
    return (
      <SharedContext.Provider value={shared}>
        {watcher}
        <Entry open={query.open} failed={gameFailed} why={gameWhy} />
      </SharedContext.Provider>
    );
  }

  const inGame = query?.source !== 'wax';
  const waitingForGame = inGame && !game && !gameFailed;
  const waitingForMembers = inGame && game !== null && needMembers && !members && !membersFailed;
  return (
    <SharedContext.Provider value={shared}>
      {watcher}
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Explorer</h1>
          <p className="max-w-2xl text-fd-muted-foreground">
            Search what Wax gives a mod and what the game itself has. Open an entry to see what it takes, what it gives
            back and how to write it in a script.
          </p>
        </header>

        {query ? (
          <>
            <FilterInput value={text} onChange={setText} label="Search the Explorer" placeholder="Search functions, events, properties and types" />

            <div className="flex flex-col gap-3">
              <div role="group" aria-label="Kind" className="flex flex-wrap items-center gap-2">
                <span className="w-14 shrink-0 text-sm text-fd-muted-foreground">Kind</span>
                <Chip on={!query.kind} onClick={() => set({ kind: '' })}>
                  All
                </Chip>
                {KINDS.map(([key, label]) => (
                  <Chip key={key} on={query.kind === key} onClick={() => set({ kind: query.kind === key ? '' : key })}>
                    {label}
                  </Chip>
                ))}
              </div>
              <div role="group" aria-label="From" className="flex flex-wrap items-center gap-2">
                <span className="w-14 shrink-0 text-sm text-fd-muted-foreground">From</span>
                <Chip on={!query.source} onClick={() => set({ source: '' })}>
                  All
                </Chip>
                {SOURCES.map(([key, label]) => (
                  <Chip key={key} on={query.source === key} onClick={() => set({ source: query.source === key ? '' : key })}>
                    {label}
                  </Chip>
                ))}
              </div>
            </div>

            {result ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-fd-muted-foreground">
                  <p aria-live="polite">
                    {count(result.total, 'result', 'results')}
                    {waitingForGame ? ". Loading the game's classes." : waitingForMembers ? ". Loading the game's member names." : null}
                  </p>
                  {result.total > 0 ? (
                    <button type="button" onClick={showAll} className={LINK}>
                      Clear the search
                    </button>
                  ) : null}
                </div>
                {inGame && gameFailed ? (
                  <LoadProblem what="The list of the game's classes" why={gameWhy} rest="Only Wax is searched." />
                ) : inGame && membersFailed && !members ? (
                  <LoadProblem what="The member names of the game" why={membersWhy} rest="Its classes are still searched." />
                ) : null}
                {result.total > 0 ? (
                  <Results hits={result.hits} />
                ) : waitingForGame || waitingForMembers ? null : (
                  <Notice text={`Nothing has a name like that. ${inGame ? SOURCE : ''}`.trim()} action="Clear the search" onAction={showAll} />
                )}
                {result.total > result.hits.length ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-fd-muted-foreground">
                      Showing {result.hits.length.toLocaleString('en-US')} of {result.total.toLocaleString('en-US')}
                    </span>
                    <button type="button" onClick={() => setLimit(limit + PAGE)} className={BUTTON}>
                      Show more
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {query.source !== 'game' ? <WaxBrowse nodes={nodes} /> : null}
                {inGame ? <GameBrowse nodes={nodes} failed={gameFailed} why={gameWhy} list={(kind) => set({ kind, source: 'game' })} /> : null}
              </>
            )}
          </>
        ) : null}
      </div>
    </SharedContext.Provider>
  );
}
