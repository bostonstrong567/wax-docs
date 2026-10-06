export const appName = 'Wax';
export const appTagline = 'Lua mods for ICARUS';
export const appDescription =
  'Wax is a Lua scripting framework for ICARUS. Write a mod in one file, save it, and see it change in the running game.';
export const docsRoute = '/docs';

// Empty in `npm run dev`, /wax-docs in a production build (see next.config.mjs).
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const searchIndexUrl = `${basePath}/search-index.json`;
