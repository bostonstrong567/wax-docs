import explorerBuild from '@/lib/explorer-stamp.json';
import iconSheet from '@/lib/icon-sheet.json';

export const appName = 'Wax';
export const appTagline = 'Lua mods for ICARUS';
export const appDescription =
  'Wax is a Lua scripting framework for ICARUS. A mod is a folder with one Lua file. Save the file and the mod reloads in the running game.';
export const docsRoute = '/docs';

// Empty in `npm run dev`, /wax-docs in a production build (see next.config.mjs).
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// The search index changes with the pages. The stamp is a hash of them (next.config.mjs), so a browser that kept
// the index of an older build asks again.
export const searchIndexUrl = `${basePath}/search-index.json?v=${process.env.NEXT_PUBLIC_PAGES_STAMP ?? '0'}`;

// The mod catalogue. Absolute, because the GitHub Pages copy of the site is on another host.
export const marketApi = 'https://wax-icarus.duckdns.org/api';

// The index of the game's classes, put there by scripts/generate-explorer.mjs. The folder is named after the data
// in it, so this page reads the data it was built with and no other.
export const explorerStamp = explorerBuild.stamp;
export const explorerDataUrl = `${basePath}/explorer-data/${explorerStamp}`;
// Which data folders the site has now. Read only to say why a file of this page's data did not come.
export const explorerBuildsUrl = `${basePath}/explorer-data/builds.json`;

// Every bundled icon on one image, put there by scripts/generate-icons.mjs under a name made from its content.
export const iconSheetUrl = `${basePath}/lucide/${iconSheet.sheet}`;
export const iconLicenseUrl = `${basePath}/lucide/LICENSE.txt`;
