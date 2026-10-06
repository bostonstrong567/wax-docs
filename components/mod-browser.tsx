'use client';
import { Download, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { type MouseEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FilterInput } from '@/components/filter-input';
import {
  ago,
  BackToList,
  BUTTON,
  day,
  Fact,
  type Go,
  LINK,
  MAIN_ACTION,
  Notice,
  plain,
  SECOND_ACTION,
  When,
} from '@/components/mod-parts';
import { type Draft, NO_DRAFT, SubmissionView, SubmitView } from '@/components/mod-submit';
import { Score, VoteButtons } from '@/components/mod-votes';
import { ApiError, getJson, onMarket, repoName, sentence, UNREACHABLE, votesOf } from '@/lib/market';
import { type ModPicture, picturesOf } from '@/lib/mod-pictures';
import { appName, marketApi } from '@/lib/shared';

type Release = {
  version: string;
  size: number;
  unpacked_size: number;
  files: number;
  dependencies: string[];
  downloads: number;
  published_at: string;
};
type Mod = {
  id: string;
  name: string;
  summary: string;
  description?: string;
  author: string;
  category: string;
  tags: string[];
  homepage: string;
  reviewed: boolean;
  downloads: number;
  created_at?: string;
  updated_at: string;
  latest: Release;
  versions?: Release[];
  // An older catalogue sends none of these four.
  pictures?: { url: string; width: number; height: number }[];
  repo?: string;
  needs_wax?: string;
  votes?: { up: number; down: number };
};
type Shown = ModPicture & { caption: string };
type ModList = { total: number; mods: Mod[] };
type Category = { name: string; mods: number };
type Tag = { tag: string; mods: number };

const SORTS = [
  ['updated', 'Recently updated'],
  ['new', 'Newest'],
  ['downloads', 'Most downloaded'],
  ['votes', 'Most liked'],
  ['name', 'Name'],
] as const;
type Sort = (typeof SORTS)[number][0];

// At most one of mod, submission and submit is set: the view that is open over the list.
type Query = {
  q: string;
  category: string;
  tags: string[];
  sort: Sort;
  page: number;
  mod: string;
  submission: string;
  submit: boolean;
};
type Change = (next: Query, how?: 'replace' | 'push') => void;

const PER_PAGE = 24;
const TAGS_SHOWN = 12;

function readQuery(search: string): Query {
  const params = new URLSearchParams(search);
  const page = Number(params.get('page'));
  const tags = params.getAll('tag').map((tag) => tag.trim().toLowerCase().replace(/[\s_]+/g, '-'));
  const mod = params.get('mod') ?? '';
  const submission = mod ? '' : (params.get('submission') ?? '').trim();
  return {
    q: (params.get('q') ?? '').trim().slice(0, 200),
    category: (params.get('category') ?? '').trim(),
    tags: [...new Set(tags.filter(Boolean))].slice(0, 10),
    sort: SORTS.find(([key]) => key === params.get('sort'))?.[0] ?? 'updated',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    mod,
    submission,
    submit: !mod && !submission && params.get('submit') === '1',
  };
}

// The address bar and the catalogue use the same parameter names.
function searchOf(query: Query, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  for (const tag of query.tags) params.append('tag', tag);
  if (query.sort !== 'updated') params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : '';
}

function viewOf(query: Query): Record<string, string> {
  if (query.mod) return { mod: query.mod };
  if (query.submission) return { submission: query.submission };
  return query.submit ? { submit: '1' } : {};
}

const addressOf = (query: Query) => searchOf(query, viewOf(query)) || './';
const listOf = (query: Query): Query => ({ ...query, mod: '', submission: '', submit: false });

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const zipUrl = (id: string, version: string) =>
  `${marketApi}/mods/${encodeURIComponent(id)}/download/${encodeURIComponent(version)}`;
// Wax on the player's PC answers this address. An id that is not a mod id gets no link.
const installUrl = (id: string) => (/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(id) ? `wax://install/${id}` : '');

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// The catalogue's pictures of a mod when it gives any, else the ones kept on this site.
function picturesFor(mod: Mod): Shown[] {
  const given = (Array.isArray(mod.pictures) ? mod.pictures : []).flatMap((picture, index) => {
    const src = onMarket(picture?.url);
    if (!src) return [];
    const sized = picture.width > 0 && picture.height > 0;
    return [
      {
        src,
        alt: `Picture ${index + 1} of ${mod.name}`,
        caption: '',
        width: sized ? picture.width : 1920,
        height: sized ? picture.height : 1080,
      },
    ];
  });
  if (given.length > 0) return given;
  return picturesOf(mod.id).map((picture) => ({ ...picture, caption: picture.alt }));
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

function InstallNote() {
  return (
    <p className="text-sm text-fd-muted-foreground">
      The Add to game button needs Wax installed. If nothing happens,{' '}
      <Link href="/docs/install" className={LINK}>
        use the download instead
      </Link>
      .
    </p>
  );
}

function Actions({ mod, small, children }: { mod: Mod; small?: boolean; children?: ReactNode }) {
  const install = installUrl(mod.id);
  const size = small ? 'px-2.5 py-1.5' : 'px-3.5 py-2';
  return (
    <div className={`flex flex-wrap items-center gap-y-2 ${small ? 'gap-x-2' : 'gap-x-3'}`}>
      {install ? (
        <a href={install} aria-label={`Add ${mod.name} to the game`} className={`${MAIN_ACTION} ${size}`}>
          <Plus aria-hidden="true" className="size-4" />
          Add to game
        </a>
      ) : null}
      <a
        href={zipUrl(mod.id, mod.latest.version)}
        aria-label={`Download the zip of ${mod.name}`}
        className={`${SECOND_ACTION} ${size}`}
      >
        <Download aria-hidden="true" className="size-4" />
        Download zip
      </a>
      {children}
    </div>
  );
}

// The pictures of a mod: one large, and a row of small ones to pick from when there are several.
function Gallery({ pictures }: { pictures: Shown[] }) {
  const [at, setAt] = useState(0);
  const shown = pictures[Math.min(at, pictures.length - 1)];
  return (
    <section className="flex flex-col gap-3">
      <a
        href={shown.src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open this picture at full size"
        className="block overflow-hidden rounded-xl border bg-fd-card outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
      >
        <img
          src={shown.src}
          alt={shown.alt}
          width={shown.width}
          height={shown.height}
          className="h-auto max-h-[80vh] w-full object-contain"
        />
      </a>
      {shown.caption ? <p className="text-sm text-fd-muted-foreground">{shown.caption}</p> : null}
      {pictures.length > 1 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {pictures.map((picture, index) => (
            <button
              key={picture.src}
              type="button"
              onClick={() => setAt(index)}
              aria-label={`Show picture ${index + 1} of ${pictures.length}`}
              aria-pressed={index === at}
              className={`overflow-hidden rounded-lg border outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-fd-ring ${
                index === at ? 'border-fd-primary' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={picture.src}
                alt=""
                width={picture.width}
                height={picture.height}
                loading="lazy"
                decoding="async"
                className="aspect-video w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// The name is the link to the mod, stretched over the card. The buttons sit above it.
function ModCard(props: { mod: Mod; href: string; onOpen: (event: MouseEvent) => void; now: number | null }) {
  const { mod, href, onOpen } = props;
  const cover = picturesFor(mod)[0];
  // The words depend on the visitor's clock, so the date stands in until the clock has been read.
  const updated = props.now === null ? day(mod.updated_at) : ago(mod.updated_at, props.now);
  return (
    <article className="relative flex min-w-0 flex-col gap-2 rounded-xl border bg-fd-card p-5 transition-colors hover:bg-fd-accent/60">
      {cover ? (
        <img
          src={cover.src}
          alt=""
          width={cover.width}
          height={cover.height}
          loading="lazy"
          decoding="async"
          className="-mx-5 -mt-5 mb-2 aspect-video w-[calc(100%+2.5rem)] max-w-none rounded-t-[11px] border-b object-cover"
        />
      ) : null}
      <h2 className="min-w-0 truncate font-medium">
        <a
          href={href}
          onClick={onOpen}
          className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-fd-ring"
        >
          {mod.name}
        </a>
      </h2>
      {mod.author ? <p className="-mt-1 truncate text-xs text-fd-muted-foreground">by {mod.author}</p> : null}
      {mod.summary ? <p className="line-clamp-3 text-sm text-fd-muted-foreground">{mod.summary}</p> : null}
      <p className="mt-auto truncate pt-2 text-xs text-fd-muted-foreground">
        <span className="font-mono">{mod.latest.version}</span>
        {updated ? (
          <>
            {' \u00b7 '}
            <When iso={mod.updated_at}>Updated {updated}</When>
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fd-muted-foreground">
        {mod.category ? <span className="rounded-full border px-2 py-0.5">{mod.category}</span> : null}
        <span>{count(mod.downloads, 'download', 'downloads')}</span>
        <Score votes={votesOf(mod.votes)} />
        {mod.reviewed ? <span>Reviewed</span> : null}
      </div>
      <div className="relative z-10 self-start pt-1">
        <Actions mod={mod} small />
      </div>
    </article>
  );
}

function ModPage(props: {
  id: string;
  mod: Mod | null;
  error: string;
  query: Query;
  change: Change;
  onRetry?: () => void;
}) {
  const { id, mod, error, query, change } = props;
  const list = listOf(query);
  const go = (next: Query) => (event: MouseEvent) => {
    if (!plain(event)) return;
    event.preventDefault();
    change(next, 'push');
  };
  const homepage = mod && /^https?:\/\//.test(mod.homepage) ? mod.homepage : '';
  const source = mod ? repoName(mod.repo) : '';
  const needsWax = mod && typeof mod.needs_wax === 'string' ? mod.needs_wax.trim() : '';
  const pictures = mod ? picturesFor(mod) : [];
  const votes = mod ? votesOf(mod.votes) : null;
  const firstDay = mod ? day(mod.created_at) : '';

  return (
    <article className="flex flex-col gap-8">
      <BackToList list={{ href: addressOf(list), onClick: go(list) }} />

      {error ? (
        <Notice text={error} action="Try again" onAction={props.onRetry} />
      ) : !mod ? (
        <p className="text-sm text-fd-muted-foreground">Loading {id}.</p>
      ) : (
        <>
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{mod.name}</h1>
              <span className="font-mono text-sm text-fd-muted-foreground">{mod.latest.version}</span>
              {needsWax ? (
                <span className="rounded-full border px-2.5 py-0.5 text-xs text-fd-muted-foreground">
                  Needs Wax {needsWax}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {mod.author ? <Fact label="Author">{mod.author}</Fact> : null}
                {mod.category ? <Fact label="Category">{mod.category}</Fact> : null}
                <Fact label="Downloads">{mod.downloads.toLocaleString('en-US')}</Fact>
                {day(mod.updated_at) ? (
                  <Fact label="Updated">
                    <When iso={mod.updated_at}>{day(mod.updated_at)}</When>
                  </Fact>
                ) : null}
                {firstDay && firstDay !== day(mod.updated_at) ? (
                  <Fact label="First published">
                    <When iso={mod.created_at}>{firstDay}</When>
                  </Fact>
                ) : null}
                <Fact label="Id">
                  <span className="font-mono">{mod.id}</span>
                </Fact>
                {mod.reviewed ? <Fact label="Status">Reviewed</Fact> : null}
              </dl>
              {votes ? <VoteButtons key={mod.id} id={mod.id} first={votes} /> : null}
            </div>
          </header>

          {pictures.length > 0 ? <Gallery key={mod.id} pictures={pictures} /> : null}

          <section className="flex flex-col items-start gap-3 rounded-xl border bg-fd-card p-5">
            <Actions mod={mod}>
              <span className="text-sm text-fd-muted-foreground">
                The zip is {bytes(mod.latest.size)} and holds {count(mod.latest.files, 'file', 'files')}.
              </span>
            </Actions>
            <InstallNote />
            <p className="text-sm text-fd-muted-foreground">
              To add the zip by hand, unzip it into the game&apos;s{' '}
              <code className="text-fd-foreground">ue4ss\Mods\Wax\mods</code> folder. The zip holds one folder,{' '}
              <code className="text-fd-foreground">{mod.id}</code>. The install page shows{' '}
              <Link href="/docs/install#where-your-mods-go" className={LINK}>
                where your mods go
              </Link>
              . A mod you add by hand while the game runs starts switched off, so flip its Enabled switch in the Wax
              panel.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">About</h2>
            {(mod.description ?? mod.summary) ? (
              <p className="max-w-3xl whitespace-pre-wrap [overflow-wrap:anywhere]">{mod.description ?? mod.summary}</p>
            ) : (
              <p className="text-fd-muted-foreground">This mod has no description.</p>
            )}
            {homepage || source ? (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {homepage ? (
                  <a href={homepage} target="_blank" rel="noopener noreferrer nofollow" className={LINK}>
                    Homepage
                  </a>
                ) : null}
                {source ? (
                  <a
                    href={`https://github.com/${source}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={LINK}
                  >
                    Source
                  </a>
                ) : null}
              </div>
            ) : null}
            {mod.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {mod.tags.map((tag) => {
                  const tagged: Query = { ...list, q: '', category: '', tags: [tag], page: 1 };
                  return (
                    <a
                      key={tag}
                      href={addressOf(tagged)}
                      onClick={go(tagged)}
                      className="rounded-full border bg-fd-card px-3 py-1 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
                    >
                      {tag}
                    </a>
                  );
                })}
              </div>
            ) : null}
          </section>

          {mod.latest.dependencies.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">Needs these mods</h2>
              <p className="text-sm text-fd-muted-foreground">Install them too. This mod does not load without them.</p>
              <div className="flex flex-wrap gap-2">
                {mod.latest.dependencies.map((other) => {
                  const needed: Query = { ...query, mod: other };
                  return (
                    <a key={other} href={addressOf(needed)} onClick={go(needed)} className={`font-mono text-sm ${LINK}`}>
                      {other}
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}

          {mod.versions ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">Versions</h2>
              <div className="relative overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-fd-card text-xs text-fd-muted-foreground">
                    <tr>
                      {['Version', 'Published', 'Size', 'Files', 'Downloads'].map((heading) => (
                        <th key={heading} scope="col" className="px-4 py-2 font-medium">
                          {heading}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-2">
                        <span className="sr-only">Download</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mod.versions.map((release) => (
                      <tr key={release.version} className="border-t">
                        <td className="px-4 py-2 font-mono">{release.version}</td>
                        <td className="whitespace-nowrap px-4 py-2">{day(release.published_at)}</td>
                        <td className="whitespace-nowrap px-4 py-2">{bytes(release.size)}</td>
                        <td className="px-4 py-2">{release.files.toLocaleString('en-US')}</td>
                        <td className="px-4 py-2">{release.downloads.toLocaleString('en-US')}</td>
                        <td className="px-4 py-2 text-right">
                          <a
                            href={zipUrl(mod.id, release.version)}
                            aria-label={`Download version ${release.version}`}
                            className={LINK}
                          >
                            Download
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <p className="text-sm text-fd-muted-foreground">Loading the versions.</p>
          )}
        </>
      )}
    </article>
  );
}

export function ModBrowser() {
  const [query, setQuery] = useState<Query | null>(null);
  const [text, setText] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [list, setList] = useState<{ search: string | null; data: ModList | null; error: string }>({
    search: null,
    data: null,
    error: '',
  });
  const [detail, setDetail] = useState<{ id: string; data: Mod | null; error: string; missing?: boolean }>({
    id: '',
    data: null,
    error: '',
  });
  const [draft, setDraft] = useState<Draft>(NO_DRAFT);
  const [now, setNow] = useState<number | null>(null);
  const [likedSort, setLikedSort] = useState(true);
  const listScroll = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    const read = () => {
      const next = readQuery(window.location.search);
      setQuery(next);
      setText(next.q);
    };
    read();
    setNow(Date.now());
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  const change: Change = useCallback((next, how = 'replace') => {
    setQuery(next);
    const url = `${window.location.pathname}${searchOf(next, viewOf(next))}`;
    if (how === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }, []);

  // The list follows the search box a moment after the last key.
  useEffect(() => {
    if (!query || text.trim() === query.q) return;
    const wait = setTimeout(() => change({ ...query, q: text.trim(), page: 1 }), 250);
    return () => clearTimeout(wait);
  }, [text, query, change]);

  useEffect(() => {
    const controller = new AbortController();
    getJson<{ categories?: Category[] }>('/categories', controller.signal).then(
      (data) => Array.isArray(data.categories) && setCategories(data.categories),
      () => {},
    );
    getJson<{ tags?: Tag[] }>('/tags', controller.signal).then(
      (data) => Array.isArray(data.tags) && setTags(data.tags),
      () => {},
    );
    return () => controller.abort();
  }, [attempt]);

  const listSearch = query ? searchOf(query, { per_page: String(PER_PAGE) }) : null;
  useEffect(() => {
    if (listSearch === null) return;
    const controller = new AbortController();
    getJson<ModList>(`/mods${listSearch}`, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setAnswered(true);
        if (Array.isArray(data.mods)) setList({ search: listSearch, data, error: '' });
        else setList({ search: listSearch, data: null, error: UNREACHABLE });
      },
      (error) => {
        if (controller.signal.aborted) return;
        // An older catalogue does not know the sort by votes and answers 400.
        if (error instanceof ApiError && error.status === 400 && /[?&]sort=votes(&|$)/.test(listSearch)) {
          setLikedSort(false);
          return;
        }
        setAnswered(true);
        setList({ search: listSearch, data: null, error: sentence(error) });
      },
    );
    return () => controller.abort();
  }, [listSearch, attempt]);

  useEffect(() => {
    if (query && !likedSort && query.sort === 'votes') change({ ...query, sort: 'updated' });
  }, [query, likedSort, change]);

  const shown = query?.mod ?? '';
  useEffect(() => {
    if (!shown) return;
    const controller = new AbortController();
    getJson<Mod>(`/mods/${encodeURIComponent(shown)}`, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        if (typeof data.id === 'string' && data.latest) setDetail({ id: shown, data, error: '' });
        else setDetail({ id: shown, data: null, error: UNREACHABLE });
      },
      (error) => {
        if (controller.signal.aborted) return;
        const missing = error instanceof ApiError && error.status === 404;
        setDetail({
          id: shown,
          data: null,
          error: missing ? `The catalogue has no mod with the id ${shown.slice(0, 64)}.` : sentence(error),
          missing,
        });
      },
    );
    return () => controller.abort();
  }, [shown, attempt]);

  const current = listSearch !== null && list.search === listSearch;
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PER_PAGE)) : 1;

  // A link to a page past the end shows the last page.
  useEffect(() => {
    if (query && current && list.data && query.page > pages) change({ ...query, page: pages });
  }, [query, current, list.data, pages, change]);

  // Opening a mod or another view starts at the top. Going back returns to the place in the list.
  const view = query ? new URLSearchParams(viewOf(query)).toString() : '';
  useLayoutEffect(() => {
    if (mounted.current) window.scrollTo(0, view ? 0 : listScroll.current);
    mounted.current = true;
  }, [view]);

  const fetched = shown && detail.id === shown ? detail : null;
  const listed = shown ? (list.data?.mods.find((mod) => mod.id === shown) ?? null) : null;
  const title = fetched?.data?.name ?? listed?.name ?? (query?.submission ? 'Submission' : query?.submit ? 'Submit a mod' : '');
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    const wanted = `${title} | ${appName}`;
    const apply = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    // The page's own title is put back once when it has loaded, so the head is watched.
    const watcher = new MutationObserver(apply);
    watcher.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      watcher.disconnect();
      document.title = before;
    };
  }, [title]);

  function retry() {
    setList({ search: null, data: null, error: '' });
    setDetail({ id: '', data: null, error: '' });
    setAttempt((n) => n + 1);
  }

  const go = (next: Query): Go => ({
    href: addressOf(next),
    onClick: (event) => {
      if (!plain(event)) return;
      event.preventDefault();
      change(next, 'push');
    },
  });

  if (query?.submission) {
    const back = listOf(query);
    return <SubmissionView id={query.submission} list={go(back)} mod={(id) => go({ ...back, mod: id })} />;
  }

  if (query?.submit) {
    const back = listOf(query);
    return (
      <SubmitView
        draft={draft}
        setDraft={setDraft}
        list={go(back)}
        status={(id) => go({ ...back, submission: id })}
        categories={categories.map((entry) => entry.name)}
      />
    );
  }

  if (query && shown) {
    return (
      <ModPage
        id={shown.slice(0, 64)}
        mod={fetched?.data ?? (fetched ? null : listed)}
        error={fetched?.error ?? ''}
        query={query}
        change={(next, how) => {
          setText(next.q);
          change(next, how);
        }}
        onRetry={fetched?.missing ? undefined : retry}
      />
    );
  }

  const filtered = query !== null && (query.q !== '' || query.category !== '' || query.tags.length > 0);
  const found = list.data?.total ?? 0;
  const waiting = !current && !list.data && !list.error;
  const narrowed = /[?&](q|category|tag)=/.test(list.search ?? '');
  const nothingYet = list.data !== null && found === 0 && !narrowed;
  const set = (patch: Partial<Query>) => query && change({ ...query, ...patch, page: 1 });
  const showAll = () => {
    setText('');
    set({ q: '', category: '', tags: [] });
  };
  const turn = (page: number) => {
    if (!query) return;
    change({ ...query, page }, 'push');
    window.scrollTo(0, 0);
  };

  const categoryChips = categories.filter((entry) => entry.mods > 0 || same(entry.name, query?.category ?? ''));
  if (query?.category && !categoryChips.some((entry) => same(entry.name, query.category))) {
    categoryChips.push({ name: query.category, mods: 0 });
  }
  const chosen = query?.tags ?? [];
  const offered = tags.map((entry) => entry.tag).slice(0, allTags ? undefined : TAGS_SHOWN);
  const tagChips = [...offered, ...chosen.filter((tag) => !offered.includes(tag))];
  // Before the address is read this is a plain link, which the browser follows.
  const submit = query ? go({ ...query, submit: true }) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Mods</h1>
          <a
            href={submit?.href ?? '?submit=1'}
            onClick={(event) => {
              listScroll.current = window.scrollY;
              submit?.onClick(event);
            }}
            className={`${SECOND_ACTION} px-3.5 py-2`}
          >
            <Upload aria-hidden="true" className="size-4" />
            Submit a mod
          </a>
        </div>
        <p className="max-w-2xl text-fd-muted-foreground">
          This is the catalogue of Wax mods. Open a mod to read what it does. You can add it to your game from here or
          download its zip.
        </p>
      </header>

      {answered && !nothingYet ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <FilterInput value={text} onChange={setText} label="Search mods" placeholder="Search mods" />
          <label className="flex shrink-0 items-center gap-2 text-sm text-fd-muted-foreground">
            Sort by
            <select
              value={query?.sort ?? 'updated'}
              onChange={(event) => set({ sort: event.target.value as Sort })}
              className="h-10 rounded-lg border bg-fd-card px-3 text-sm text-fd-foreground outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              {SORTS.filter(([key]) => likedSort || key !== 'votes').map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {categoryChips.length > 0 || tagChips.length > 0 ? (
        <div className="flex flex-col gap-3">
          {categoryChips.length > 0 ? (
            <div role="group" aria-label="Category" className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-sm text-fd-muted-foreground">Category</span>
              <Chip on={!query?.category} onClick={() => set({ category: '' })}>
                All
              </Chip>
              {categoryChips.map((entry) => (
                <Chip
                  key={entry.name}
                  on={same(entry.name, query?.category ?? '')}
                  onClick={() => set({ category: same(entry.name, query?.category ?? '') ? '' : entry.name })}
                >
                  {entry.name}
                  {entry.mods > 0 ? <span className="ml-1.5 text-xs opacity-70">{entry.mods}</span> : null}
                </Chip>
              ))}
            </div>
          ) : null}
          {tagChips.length > 0 ? (
            <div role="group" aria-label="Tags" className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-sm text-fd-muted-foreground">Tags</span>
              {tagChips.map((tag) => (
                <Chip
                  key={tag}
                  on={chosen.includes(tag)}
                  onClick={() =>
                    set({ tags: chosen.includes(tag) ? chosen.filter((other) => other !== tag) : [...chosen, tag].slice(0, 10) })
                  }
                >
                  {tag}
                </Chip>
              ))}
              {tags.length > TAGS_SHOWN ? (
                <button type="button" onClick={() => setAllTags(!allTags)} className={`text-sm ${LINK}`}>
                  {allTags ? 'Show fewer tags' : 'Show all tags'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-fd-muted-foreground empty:hidden">
        {found > 0 || waiting ? <p aria-live="polite">{found > 0 ? count(found, 'mod', 'mods') : 'Loading mods.'}</p> : null}
        {filtered && found > 0 ? (
          <button type="button" onClick={showAll} className={LINK}>
            Show all mods
          </button>
        ) : null}
      </div>

      {list.error ? (
        <Notice text={list.error} action="Try again" onAction={retry} />
      ) : list.data && list.data.total === 0 ? (
        narrowed ? (
          <Notice text="No mods match your search." action="Show all mods" onAction={showAll} />
        ) : (
          <div className="flex flex-col items-start gap-2 rounded-xl border bg-fd-card p-6">
            <p className="font-medium">No mods have been published yet.</p>
            <p className="text-sm text-fd-muted-foreground">
              You can write your own. Start with{' '}
              <Link href="/docs/first-mod" className={LINK}>
                Your first mod
              </Link>
              .
            </p>
          </div>
        )
      ) : list.data && query ? (
        <>
          <div className="-mt-4">
            <InstallNote />
          </div>
          <div className={`grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${current ? '' : 'opacity-60'}`}>
            {list.data.mods.map((mod) => (
              <ModCard
                key={mod.id}
                mod={mod}
                now={now}
                href={searchOf(query, { mod: mod.id })}
                onOpen={(event) => {
                  if (!plain(event)) return;
                  event.preventDefault();
                  listScroll.current = window.scrollY;
                  change({ ...query, mod: mod.id }, 'push');
                }}
              />
            ))}
          </div>
          {pages > 1 ? (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3">
              <button type="button" disabled={query.page <= 1} onClick={() => turn(query.page - 1)} className={BUTTON}>
                Previous
              </button>
              <span className="text-sm text-fd-muted-foreground">
                Page {query.page} of {pages}
              </span>
              <button type="button" disabled={query.page >= pages} onClick={() => turn(query.page + 1)} className={BUTTON}>
                Next
              </button>
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
