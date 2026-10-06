import { HomeLayout } from 'fumadocs-ui/layouts/home';
import Link from 'next/link';
import { baseOptions } from '@/lib/layout.shared';

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-6 py-24">
        <p className="text-sm font-medium text-fd-primary">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">This page does not exist</h1>
        <p className="text-fd-muted-foreground">The page may have moved. Search with Ctrl+K, or start from the docs.</p>
        <Link
          href="/docs"
          className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
        >
          Open the docs
        </Link>
      </main>
    </HomeLayout>
  );
}
