'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export type Slide = { src: string; alt: string };

// One picture at a time, as wide as the page. Arrows and dots move between them, and so does a swipe.
export function Tour({ slides }: { slides: Slide[] }) {
  const strip = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);

  const go = useCallback(
    (index: number) => {
      const box = strip.current;
      if (!box) return;
      const next = Math.max(0, Math.min(slides.length - 1, index));
      box.scrollTo({ left: next * box.clientWidth, behavior: 'smooth' });
    },
    [slides.length],
  );

  useEffect(() => {
    const box = strip.current;
    if (!box) return;
    const seen = () => setAt(Math.round(box.scrollLeft / Math.max(1, box.clientWidth)));
    box.addEventListener('scroll', seen, { passive: true });
    return () => box.removeEventListener('scroll', seen);
  }, []);

  const arrow =
    'absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-fd-background/80 text-fd-foreground backdrop-blur transition-opacity hover:bg-fd-accent disabled:pointer-events-none disabled:opacity-0';

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div
          ref={strip}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-xl border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, index) => (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              width={1600}
              height={900}
              loading={index === 0 ? 'eager' : 'lazy'}
              className="h-auto w-full shrink-0 snap-center"
            />
          ))}
        </div>
        <button type="button" aria-label="The picture before" disabled={at === 0} onClick={() => go(at - 1)} className={`${arrow} left-3`}>
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label="The next picture"
          disabled={at === slides.length - 1}
          onClick={() => go(at + 1)}
          className={`${arrow} right-3`}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="flex justify-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Picture ${index + 1} of ${slides.length}`}
            aria-current={index === at}
            onClick={() => go(index)}
            className={`h-2 rounded-full transition-all ${index === at ? 'w-6 bg-fd-primary' : 'w-2 bg-fd-muted-foreground/40 hover:bg-fd-muted-foreground/70'}`}
          />
        ))}
      </div>
    </div>
  );
}
