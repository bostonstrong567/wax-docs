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
    env: { NEXT_PUBLIC_BASE_PATH: basePath },
  };

  return withMDX(nextConfig);
}
