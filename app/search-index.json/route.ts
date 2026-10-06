import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Written to out/search-index.json at build time; the browser downloads it and searches locally.
export const revalidate = false;
export const dynamic = 'force-static';

export const { staticGET: GET } = createFromSource(source, {
  language: 'english',
});
