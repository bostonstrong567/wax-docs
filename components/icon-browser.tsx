'use client';
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FilterInput } from '@/components/filter-input';
import icons from '@/lib/icon-names.json';
import { iconSheetUrl } from '@/lib/shared';

const CELL_MIN = 108;
const ROW = 92;
const PAD = 8;
const SPARE_ROWS = 3;

const all = icons.names.map((name, index) => ({
  name,
  at: `-${(index % icons.columns) * icons.cell}px -${Math.floor(index / icons.columns) * icons.cell}px`,
}));
const total = all.length.toLocaleString('en-US');

// Every typed word has to be in the name. Names that start with what was typed come first.
function find(text: string) {
  const words = text.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return all;
  const typed = words.join('-');
  const rank = (name: string) => (name === typed ? 0 : name.startsWith(typed) ? 1 : name.includes(typed) ? 2 : 3);
  return all
    .filter((icon) => words.every((word) => icon.name.includes(word)))
    .map((icon) => ({ icon, rank: rank(icon.name) }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.icon);
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The clipboard API needs https. This older way works without it.
    const focused = document.activeElement;
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const done = document.execCommand('copy');
    area.remove();
    if (focused instanceof HTMLElement) focused.focus();
    return done;
  }
}

export function IconBrowser() {
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [text, setText] = useState('');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [firstRow, setFirstRow] = useState(0);
  const [copied, setCopied] = useState<{ name: string; done: boolean } | null>(null);

  useEffect(() => {
    const typed = new URLSearchParams(window.location.search).get('q');
    if (typed) setText(typed.slice(0, 200));
    return () => clearTimeout(timer.current);
  }, []);

  // The address bar follows the search box, so a search can be shared as a link.
  useEffect(() => {
    const wait = setTimeout(() => {
      const typed = text.trim();
      const search = typed ? `?q=${encodeURIComponent(typed)}` : '';
      if (search !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${search}`);
    }, 300);
    return () => clearTimeout(wait);
  }, [text]);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth - 2 * PAD, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const found = useMemo(() => find(text), [text]);

  // Only the rows in view are drawn, plus a few above and below.
  const columns = Math.max(1, Math.floor(size.width / CELL_MIN));
  const rows = Math.ceil(found.length / columns);
  const from = Math.max(0, firstRow - SPARE_ROWS);
  const to = Math.min(rows, firstRow + Math.ceil(size.height / ROW) + SPARE_ROWS + 1);
  const shown = size.width > 0 ? found.slice(from * columns, to * columns) : [];

  function search(value: string) {
    setText(value);
    setFirstRow(0);
    if (box.current) box.current.scrollTop = 0;
  }

  async function pick(name: string) {
    const done = await copy(name);
    setCopied({ name, done });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterInput value={text} onChange={search} label="Search icons" placeholder="Search icons by name" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-fd-muted-foreground">
        <p>{found.length === all.length ? `${total} icons` : `${found.length.toLocaleString('en-US')} of ${total} icons`}</p>
        <p aria-live="polite" className={copied?.done ? 'text-fd-primary' : undefined}>
          {copied ? (copied.done ? `Copied ${copied.name}` : `Could not copy ${copied.name}`) : 'Click an icon to copy its name.'}
        </p>
      </div>
      <div
        ref={box}
        onScroll={(event) => setFirstRow(Math.floor(event.currentTarget.scrollTop / ROW))}
        className="h-[65vh] min-h-80 overflow-y-auto rounded-xl border bg-fd-card [scrollbar-gutter:stable]"
        style={{ '--icon-sheet': `url(${iconSheetUrl})` } as CSSProperties}
      >
        {found.length === 0 ? (
          <p className="p-6 text-sm text-fd-muted-foreground">No icon has a name like that.</p>
        ) : (
          <div style={{ padding: PAD }}>
            <div className="relative" style={{ height: rows * ROW }}>
              <div
                className="absolute inset-x-0 grid"
                style={{
                  top: from * ROW,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gridAutoRows: ROW,
                }}
              >
                {shown.map((icon) => {
                  const justCopied = copied?.done === true && copied.name === icon.name;
                  return (
                    <button
                      key={icon.name}
                      type="button"
                      title={icon.name}
                      onClick={() => pick(icon.name)}
                      className={`flex flex-col items-center gap-2 rounded-lg px-1.5 pt-3.5 outline-none transition-colors hover:bg-fd-accent focus-visible:bg-fd-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring ${
                        justCopied ? 'text-fd-primary' : 'text-fd-foreground'
                      }`}
                    >
                      <span aria-hidden="true" className="sheet-icon" style={{ '--icon-at': icon.at } as CSSProperties} />
                      <span
                        className={`line-clamp-2 w-full text-center text-[11px] leading-[14px] [overflow-wrap:anywhere] ${
                          justCopied ? 'font-medium' : 'text-fd-muted-foreground'
                        }`}
                      >
                        {justCopied ? 'Copied' : icon.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
