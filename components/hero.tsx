import { basePath } from '@/lib/shared';

type Ghost = { file: string; className: string; style: React.CSSProperties };

// Faint windows that drift slowly behind the picture. Each has its own place, tilt, pace and start.
const ghosts: Ghost[] = [
  { file: 'ghost-performance.webp', className: 'left-[-5%] top-[5%] w-[25%]', style: { ['--tilt' as string]: '-9deg', animationDuration: '11s' } },
  { file: 'ghost-icons.webp', className: 'right-[-5%] top-[3%] w-[24%]', style: { ['--tilt' as string]: '8deg', animationDuration: '13s', animationDelay: '-4s' } },
  { file: 'ghost-browse.webp', className: 'left-[2%] bottom-[-11%] w-[21%]', style: { ['--tilt' as string]: '6deg', animationDuration: '14s', animationDelay: '-7s' } },
  { file: 'ghost-performance.webp', className: 'right-[1%] bottom-[-12%] w-[22%]', style: { ['--tilt' as string]: '-7deg', animationDuration: '12s', animationDelay: '-2s' } },
  { file: 'ghost-icons.webp', className: 'left-[38%] top-[-15%] w-[19%]', style: { ['--tilt' as string]: '3deg', animationDuration: '16s', animationDelay: '-9s' } },
];

// The picture at the top of the home page: three windows of the Wax panel on a dark ground with a glow.
export function Hero({ alt }: { alt: string }) {
  return (
    <div className="wax-hero relative aspect-[1840/976] w-full overflow-hidden rounded-xl border">
      {ghosts.map((ghost, index) => (
        <img
          key={index}
          src={`${basePath}/img/hero/${ghost.file}`}
          alt=""
          aria-hidden
          className={`wax-ghost pointer-events-none absolute select-none ${ghost.className}`}
          style={ghost.style}
        />
      ))}
      <img
        src={`${basePath}/img/hero/windows.webp`}
        alt={alt}
        width={1840}
        height={976}
        className="wax-hero-main absolute inset-0 size-full object-contain"
      />
    </div>
  );
}
