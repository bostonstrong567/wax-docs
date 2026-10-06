import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import { basePath } from '@/lib/shared';

// Width and height come from the PNG header, so a screenshot is never drawn wider than it is.
function pngSize(file: string) {
  const header = Buffer.alloc(24);
  const handle = fs.openSync(file, 'r');
  try {
    fs.readSync(handle, header, 0, 24, 0);
  } finally {
    fs.closeSync(handle);
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

export function Shot({ src, alt, caption }: { src: string; alt: string; caption?: ReactNode }) {
  const { width, height } = pngSize(path.join(process.cwd(), 'public', 'img', src));
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
