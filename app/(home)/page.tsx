import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import { Activity, Boxes, Keyboard, LayoutPanelLeft, RefreshCw, Timer } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Shot } from '@/components/shot';

const firstMod = `local window = ui.Window({
    title = "My first mod",
    icon = "sparkles",
    width = 300,
    height = 170,
})

window:Label("Hello from my first mod.")

window:Toggle("Show the overlay", true, function(on)
    print("overlay", on)
end)

window:Button("Say hi", function()
    ui.Notify("Hi from my first mod!", { kind = "good" })
end, { primary = true })`;

const features: { icon: ReactNode; title: string; text: string; href: string }[] = [
  {
    icon: <RefreshCw className="size-4" />,
    title: 'Save and see it',
    text: 'Save your file and the mod reloads in the running game. No restart.',
    href: '/docs/hot-reload',
  },
  {
    icon: <LayoutPanelLeft className="size-4" />,
    title: 'Windows without the work',
    text: 'Buttons, switches, sliders, lists, overlays and notifications, each in one line.',
    href: '/docs/gui/controls',
  },
  {
    icon: <Boxes className="size-4" />,
    title: 'The game as a tree',
    text: 'Start at game, walk to the world, the player and every object in it.',
    href: '/docs/game',
  },
  {
    icon: <Timer className="size-4" />,
    title: 'Tasks and signals',
    text: 'Wait, repeat and react to events without freezing the game.',
    href: '/docs/tasks',
  },
  {
    icon: <Activity className="size-4" />,
    title: 'A panel inside the game',
    text: 'See your mods, the log, errors and frame cost. Run a line of Lua on the spot.',
    href: '/docs/debug-panel',
  },
  {
    icon: <Keyboard className="size-4" />,
    title: 'Help while you type',
    text: 'Completion and descriptions for every Wax function in your editor.',
    href: '/docs/editor',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-14 md:py-20">
      <section className="flex flex-col items-start gap-6">
        <span className="rounded-full border bg-fd-card px-3 py-1 text-xs font-medium text-fd-muted-foreground">
          In development. Not released for download yet.
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
          Lua mods for <span className="text-fd-primary">ICARUS</span>
        </h1>
        <p className="max-w-2xl text-lg text-fd-muted-foreground">
          Wax is a Lua scripting framework for ICARUS. Write a mod in one file. Save it. See it change in the
          running game.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs"
            className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Read the docs
          </Link>
          <Link
            href="/docs/first-mod"
            className="rounded-lg border bg-fd-card px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Your first mod in five minutes
          </Link>
        </div>
      </section>

      <section className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="mb-3 text-sm font-medium text-fd-muted-foreground">This file, saved as init.lua</p>
          <ServerCodeBlock code={firstMod} lang="lua" codeblock={{ className: 'my-0' }} />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium text-fd-muted-foreground">makes this window in the game</p>
          <div className="[&_figure]:my-0">
            <Shot
              src="window.png"
              alt="A small game window titled My first mod, with a line of text, a switch labelled Show the overlay and a blue Say hi button."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Link
            key={feature.title}
            href={feature.href}
            className="flex flex-col gap-2 rounded-xl border bg-fd-card p-5 transition-colors hover:bg-fd-accent/60"
          >
            <span className="flex size-8 items-center justify-center rounded-lg border bg-fd-background text-fd-primary">
              {feature.icon}
            </span>
            <h2 className="font-medium">{feature.title}</h2>
            <p className="text-sm text-fd-muted-foreground">{feature.text}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
