import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMDX } from 'fumadocs-mdx/next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const withMDX = createMDX();

// DOCS_BASE_PATH wins when it is set (an empty value means "served from the root").
// Without it: no prefix in `npm run dev`, /wax-docs in a production build.
function resolveBasePath(phase) {
  const fromEnv = process.env.DOCS_BASE_PATH;
  const value = fromEnv !== undefined ? fromEnv : phase === PHASE_DEVELOPMENT_SERVER ? '' : '/wax-docs';
  const trimmed = value.trim().replace(/\/+$/, '');
  if (trimmed === '') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

// A hash of every page's source. It is part of the address of the search index, which is made from the pages.
function pagesStamp() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'content');
  const hash = crypto.createHash('sha256');
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else hash.update(`${path.relative(root, full)}\0`).update(fs.readFileSync(full));
    }
  };
  visit(root);
  return hash.digest('hex').slice(0, 12);
}

export default function config(phase) {
  const basePath = resolveBasePath(phase);

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    output: 'export',
    reactStrictMode: true,
    trailingSlash: true,
    basePath: basePath || undefined,
    assetPrefix: basePath || undefined,
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_PAGES_STAMP: pagesStamp() },
  };

  return withMDX(nextConfig);
}
