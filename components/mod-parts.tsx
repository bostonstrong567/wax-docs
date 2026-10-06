import { ArrowLeft } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';

export const LINK = 'text-fd-primary underline underline-offset-4';
export const BUTTON =
  'rounded-lg border bg-fd-card px-3 py-1.5 text-sm font-medium transition-colors outline-none hover:bg-fd-accent focus-visible:ring-2 focus-visible:ring-fd-ring disabled:pointer-events-none disabled:opacity-40';
export const MAIN_ACTION =
  'inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-fd-primary text-sm font-medium text-fd-primary-foreground transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-fd-ring disabled:pointer-events-none disabled:opacity-60';
export const SECOND_ACTION =
  'inline-flex items-center gap-1.5 rounded-lg border bg-fd-background text-sm font-medium transition-colors outline-none hover:bg-fd-accent focus-visible:ring-2 focus-visible:ring-fd-ring';

// A link that changes the view in place: the address for the browser, and what a plain click does.
export type Go = { href: string; onClick: (event: MouseEvent) => void };

// A click with a modifier key, or with another button, is left to the browser.
export function plain(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

// Null for a date that is missing or cannot be read.
function dateOf(iso: unknown) {
  if (typeof iso !== 'string' || iso === '') return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function day(iso: unknown) {
  return dateOf(iso)?.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) ?? '';
}

// "today", "yesterday" or "N days ago" for the last 30 days by the visitor's calendar, then the date.
export function ago(iso: unknown, now: number) {
  const date = dateOf(iso);
  if (!date) return '';
  const midnight = (time: Date) => new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
  const days = Math.round((midnight(new Date(now)) - midnight(date)) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  return days <= 30 ? `${days} days ago` : day(iso);
}

// A date as a time element with the exact moment as its tooltip. Nothing for a date that cannot be read.
export function When({ iso, children }: { iso: unknown; children: ReactNode }) {
  const date = dateOf(iso);
  if (!date) return null;
  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}>
      {children}
    </time>
  );
}

export function Notice({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
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

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-fd-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function BackToList({ list }: { list: Go }) {
  return (
    <a
      {...list}
      className="inline-flex items-center gap-1.5 self-start text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      All mods
    </a>
  );
}
