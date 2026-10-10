'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { basePath } from '@/lib/shared';

export type HeroSlide = { file: string; alt: string };

type Ghost = { file: string; className: string; style: React.CSSProperties };

// Faint windows behind the first picture. A short drift, each on its own pace. The sharp windows stay still.
const ghosts: Ghost[] = [
  { file: 'ghost-performance.webp', className: 'left-[-3%] top-[3%] w-[24%]', style: { ['--tilt' as string]: '-10deg', ['--far' as string]: '12px', ['--side' as string]: '8px', animationDuration: '22s' } },
  { file: 'ghost-icons.webp', className: 'right-[-3%] top-[1%] w-[23%]', style: { ['--tilt' as string]: '9deg', ['--far' as string]: '14px', ['--side' as string]: '-7px', animationDuration: '26s', animationDelay: '-6s' } },
  { file: 'ghost-browse.webp', className: 'left-[1%] bottom-[-6%] w-[21%]', style: { ['--tilt' as string]: '7deg', ['--far' as string]: '11px', ['--side' as string]: '-9px', animationDuration: '24s', animationDelay: '-11s' } },
  { file: 'ghost-performance.webp', className: 'right-[0%] bottom-[-7%] w-[22%]', style: { ['--tilt' as string]: '-8deg', ['--far' as string]: '13px', ['--side' as string]: '8px', animationDuration: '28s', animationDelay: '-3s' } },
  { file: 'ghost-icons.webp', className: 'left-[39%] top-[-13%] w-[20%]', style: { ['--tilt' as string]: '4deg', ['--far' as string]: '10px', ['--side' as string]: '9px', animationDuration: '30s', animationDelay: '-14s' } },
  { file: 'ghost-browse.webp', className: 'left-[40%] bottom-[-16%] w-[19%]', style: { ['--tilt' as string]: '-5deg', ['--far' as string]: '12px', ['--side' as string]: '-8px', animationDuration: '25s', animationDelay: '-8s' } },
];

const EVERY = 6500; // milliseconds a picture stays before the next comes by itself

// The pictures at the top of the home page, one at a time. The first is three still windows of the Wax panel,
// with faint ones drifting behind and a slow light crossing the glass. Arrows show under the mouse, dots at the
// bottom pick a picture, and it moves on by itself.
export function Hero({ alt, slides }: { alt: string; slides: HeroSlide[] }) {
  const count = slides.length + 1;
  const [at, setAt] = useState(0);
  const [from, setFrom] = useState(1); // 1: the new picture comes from the right, -1: from the left
  const [held, setHeld] = useState(false);
  const touch = useRef<number | null>(null);

  const go = useCallback(
    (index: number, way?: number) => {
      setAt((now) => {
        const next = ((index % count) + count) % count;
        setFrom(way ?? (next >= now ? 1 : -1));
        return next;
      });
    },
    [count],
  );

  useEffect(() => {
    if (held) return;
    // an interval, so a tab that was in the background when its turn came goes on once it is looked at again
    const timer = window.setInterval(() => {
      if (!document.hidden) go(at + 1, 1);
    }, EVERY);
    return () => window.clearInterval(timer);
  }, [at, held, go]);

  const place = (index: number) =>
    index === at
      ? 'opacity-100 translate-x-0 scale-100'
      : `pointer-events-none opacity-0 scale-[0.985] ${from > 0 === index > at || (at === 0 && index === count - 1 && from < 0) ? 'translate-x-[3%]' : '-translate-x-[3%]'}`;

  const arrow =
    'absolute top-1/2 z-20 flex size-10 cursor-pointer -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/90 opacity-0 shadow-lg backdrop-blur-md transition duration-300 hover:scale-110 hover:bg-black/55 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-80';

  return (
    <div
      className="wax-hero group relative aspect-[1840/976] w-full overflow-hidden rounded-xl border"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') go(at - 1, -1);
        if (event.key === 'ArrowRight') go(at + 1, 1);
      }}
      onTouchStart={(event) => {
        touch.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (touch.current === null) return;
        const moved = event.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(moved) > 40) go(at + (moved < 0 ? 1 : -1), moved < 0 ? 1 : -1);
      }}
    >
      <div className="wax-glow wax-glow-gold" aria-hidden />
      <div className="wax-glow wax-glow-teal" aria-hidden />
      <div className={`absolute inset-0 transition duration-700 ease-out ${place(0)}`} aria-hidden={at !== 0}>
        {ghosts.map((ghost, index) => (
          <div
            key={index}
            aria-hidden
            className={`wax-ghost pointer-events-none absolute aspect-[1140/988] bg-contain bg-no-repeat ${ghost.className}`}
            style={{ ...ghost.style, backgroundImage: `url(${basePath}/img/hero/${ghost.file})` }}
          />
        ))}
        <img
          src={`${basePath}/img/hero/windows.webp`}
          alt={alt}
          width={1840}
          height={976}
          className="absolute inset-0 size-full object-contain"
        />
      </div>
      {slides.map((slide, index) => (
        <div key={slide.file} className={`absolute inset-0 transition duration-700 ease-out ${place(index + 1)}`} aria-hidden={at !== index + 1}>
          <img
            src={`${basePath}/img/hero/${slide.file}`}
            alt={slide.alt}
            width={1840}
            height={976}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
      ))}

      <div className="wax-sheen" aria-hidden />

      <button type="button" aria-label="The picture before" onClick={() => go(at - 1, -1)} className={`${arrow} left-2`}>
        <ChevronLeft className="size-5" />
      </button>
      <button type="button" aria-label="The next picture" onClick={() => go(at + 1, 1)} className={`${arrow} right-2`}>
        <ChevronRight className="size-5" />
      </button>

      <div className="absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-2 z-20 flex items-center justify-center gap-0.5">
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Picture ${index + 1} of ${count}`}
            aria-current={index === at}
            onClick={() => go(index)}
            className="group/dot cursor-pointer px-1 py-2"
          >
            <span
              className={`relative block h-2 overflow-hidden rounded-full transition-all duration-500 ${index === at ? 'w-8 bg-white/30' : 'w-2 bg-white/35 group-hover/dot:scale-125 group-hover/dot:bg-white/80'}`}
            >
              {index === at ? (
                <span
                  key={`${at}-${held}`}
                  className="wax-dot-fill absolute inset-y-0 left-0 rounded-full bg-fd-primary"
                  style={{ animationDuration: `${EVERY}ms`, animationPlayState: held ? 'paused' : 'running', width: held ? '100%' : undefined }}
                />
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
