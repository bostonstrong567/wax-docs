export const appName = 'Wax';
export const appTagline = 'Lua mods for ICARUS';
export const appDescription =
  'Wax is a Lua scripting framework for ICARUS. A mod is a folder with one Lua file. Save the file and the mod reloads in the running game.';
export const docsRoute = '/docs';

// Empty in `npm run dev`, /wax-docs in a production build (see next.config.mjs).
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const searchIndexUrl = `${basePath}/search-index.json`;

// The mod catalogue. Absolute, because the GitHub Pages copy of the site is on another host.
export const marketApi = 'https://wax-icarus.duckdns.org/api';

// The index of the game's classes, put there by scripts/generate-explorer.mjs.
export const explorerDataUrl = `${basePath}/explorer-data`;

// Every bundled icon on one image, put there by scripts/generate-icons.mjs.
export const iconSheetUrl = `${basePath}/lucide/sheet32.png`;
export const iconLicenseUrl = `${basePath}/lucide/LICENSE.txt`;
