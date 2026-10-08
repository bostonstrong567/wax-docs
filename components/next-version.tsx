import type { ReactNode } from 'react';
import { Callout } from 'fumadocs-ui/components/callout';

// The newest Wax a player can download. Raise it when a release is out: every mark on the site goes by it.
const RELEASED = '0.2.1';
// Set to true on the day the next version is released. Every mark then disappears from the site.
const NEXT_IS_OUT = false;

// The line on a page or a section that describes something newer than the released Wax.
// Text inside it is added after the line, for what the released version does instead.
export function NextVersion({ children }: { children?: ReactNode }) {
  if (NEXT_IS_OUT) return null;
  return (
    <Callout>
      This comes with the next version of Wax. It is not in Wax {RELEASED}, the version you can download today.
      {children ? <> {children}</> : null}
    </Callout>
  );
}
