import type { Metadata } from 'next';
import { Explorer } from '@/components/explorer';

export const metadata: Metadata = {
  title: 'Explorer',
  description: 'Search every function, event and type of Wax and of the game. See what each one takes, what it gives back and how to write it.',
};

export default function ExplorerPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10 md:py-14">
      <Explorer />
    </div>
  );
}
