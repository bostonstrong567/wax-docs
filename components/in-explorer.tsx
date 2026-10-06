import Link from 'next/link';

// The link from a reference entry to the same thing in the Explorer.
export function InExplorer({ id }: { id: string }) {
  return (
    <p className="not-prose mb-8 text-sm">
      <Link
        href={`/explorer?wax=${encodeURIComponent(id)}`}
        prefetch={false}
        className="text-fd-muted-foreground underline decoration-fd-border underline-offset-4 transition-colors hover:text-fd-primary"
      >
        Open in the Explorer
      </Link>
    </p>
  );
}
