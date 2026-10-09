import type { ReactNode } from 'react';
import { Callout } from 'fumadocs-ui/components/callout';

// The newest Wax a player can download. Raise it when a release is out: every mark on the site goes by it.
export const RELEASED = '0.3.10';
// Set to true on the day the next version is released. Every mark then disappears from the site.
export const NEXT_IS_OUT = true;

export const NEXT_SENTENCE = `This comes with the next version of Wax. It is not in Wax ${RELEASED}, the version you can download today.`;

// The line on a page or a section that describes something newer than the released Wax.
// Text inside it is added after the line, for what the released version does instead.
export function NextVersion({ children }: { children?: ReactNode }) {
  if (NEXT_IS_OUT) return null;
  return (
    <Callout>
      {NEXT_SENTENCE}
      {children ? <> {children}</> : null}
    </Callout>
  );
}

function newer(version: string, than: string) {
  const a = version.split('.').map(Number);
  const b = than.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

// The line on a section that needs a named version of Wax. It goes away by itself once RELEASED reaches that version.
export function Since({ version }: { version: string }) {
  if (!newer(version, RELEASED)) return null;
  return (
    <Callout>
      This comes with Wax {version}. It is not in Wax {RELEASED}, the version you can download today.
    </Callout>
  );
}

const MARK = 'inline-block whitespace-nowrap rounded-full border px-1.5 py-px align-middle font-sans text-[11px] font-normal leading-4 text-fd-muted-foreground';

// The small mark on one entry of a list that is newer than the released Wax: a function, a field, an option.
// `block` puts it on a line of its own, under a heading.
export function NextMark({ block }: { block?: boolean }) {
  if (NEXT_IS_OUT) return null;
  const mark = (
    <span title={NEXT_SENTENCE} className={MARK}>
      Next version
    </span>
  );
  return block ? <p className="not-prose -mt-2 mb-4">{mark}</p> : mark;
}

// Says once, at the top of a page that has such marks, what they mean.
export function NextLegend() {
  if (NEXT_IS_OUT) return null;
  return (
    <p className="not-prose mb-6 text-sm text-fd-muted-foreground">
      What is marked <NextMark /> comes with the next version of Wax. It is not in Wax {RELEASED}, the version you can
      download today.
    </p>
  );
}
