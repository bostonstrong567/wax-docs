import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ModBrowser } from '@/components/mod-browser';

export const metadata: Metadata = {
  title: 'Mods',
  description: 'The catalogue of Wax mods. Search it, read about a mod and add it to your game.',
};

export default function ModsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10 md:py-14">
      <Suspense fallback={null}>
        <ModBrowser />
      </Suspense>
    </div>
  );
}
