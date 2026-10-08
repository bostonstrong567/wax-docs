import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import { basePath } from '@/lib/shared';

// Width and height come from the file's header (PNG or WebP), so a screenshot is never drawn wider than it is.
function imageSize(file: string) {
  const header = Buffer.alloc(32);
  const handle = fs.openSync(file, 'r');
  try {
    fs.readSync(handle, header, 0, 32, 0);
  } finally {
    fs.closeSync(handle);
  }
  if (header.toString('latin1', 0, 4) !== 'RIFF') return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  const kind = header.toString('latin1', 12, 16);
  if (kind === 'VP8X') return { width: header.readUIntLE(24, 3) + 1, height: header.readUIntLE(27, 3) + 1 };
  if (kind === 'VP8L') {
    const bits = header.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { width: header.readUInt16LE(26) & 0x3fff, height: header.readUInt16LE(28) & 0x3fff };
}

export function Shot({ src, alt, caption }: { src: string; alt: string; caption?: ReactNode }) {
  const { width, height } = imageSize(path.join(process.cwd(), 'public', 'img', src));
  return (
    <figure className="not-prose my-6 flex flex-col items-start gap-2">
      <img
        src={`${basePath}/img/${src}`}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="h-auto max-w-full drop-shadow-xl"
      />
      {caption ? <figcaption className="text-sm text-fd-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

export function ShotRow({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-6 grid grid-cols-1 items-start gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 [&_figure]:my-0">
      {children}
    </div>
  );
}
