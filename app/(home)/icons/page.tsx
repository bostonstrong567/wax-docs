import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import type { Metadata } from 'next';
import Link from 'next/link';
import { IconBrowser } from '@/components/icon-browser';
import icons from '@/lib/icon-names.json';
import { iconLicenseUrl } from '@/lib/shared';

const count = icons.names.length.toLocaleString('en-US');

const example = `local window = ui.Window({ title = "Travel", icon = "map" })

window:Button("Go", function()
    ui.Notify("On the way.", { icon = "map-pin" })
end, { icon = "map-pin" })`;

export const metadata: Metadata = {
  title: 'Icons',
  description: `The ${count} icons that come with Wax. Search them and copy a name.`,
};

export default function IconsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Icons</h1>
        <p className="max-w-2xl text-fd-muted-foreground">
          Wax comes with {count} icons. A mod uses an icon by its name.
        </p>
      </header>

      <IconBrowser />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Use a name in your mod</h2>
        <p className="max-w-2xl text-sm text-fd-muted-foreground">
          Put the name where an icon goes. The{' '}
          <Link href="/docs/gui/icons" className="text-fd-primary underline underline-offset-4">
            Icons page of the docs
          </Link>{' '}
          lists every place that takes one.
        </p>
        <ServerCodeBlock code={example} lang="lua" codeblock={{ className: 'my-0' }} />
        <p className="text-sm text-fd-muted-foreground">
          The icons are from{' '}
          <a href="https://lucide.dev" rel="noreferrer" className="text-fd-primary underline underline-offset-4">
            Lucide
          </a>
          . Read the{' '}
          <a href={iconLicenseUrl} className="text-fd-primary underline underline-offset-4">
            licence
          </a>
          .
        </p>
      </section>
    </div>
  );
}
