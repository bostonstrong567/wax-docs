# Wax documentation

The documentation site for Wax, a Lua scripting framework for ICARUS. It is a [Fumadocs](https://fumadocs.dev)
site on Next.js, built as a fully static export and served by GitHub Pages as a project site, under the
path `/wax-docs`.

Wax is in development and not released for download yet. The site says so on its first page.

## Run it

You need Node 20.9 or newer (the workflow uses Node 24).

```powershell
npm install
npm run dev        # http://localhost:3000, no path prefix, reloads as you edit
```

## Build it

```powershell
npm run build      # writes the static site to out\
npm run check      # checks every internal link, image and #anchor in out\
npm run serve      # serves out\ at http://localhost:4173/wax-docs/
```

`npm run serve` behaves like GitHub Pages for a project site: everything lives under a path prefix, a folder
without a trailing slash redirects, and a missing page gets `404.html`. Pass `--port 5000` or `--base /other`
after `--` to change the port or the prefix (`npm run serve -- --port 5000`).

`npm run build` does three things in a row: it regenerates the reference (see below), runs `next build`, and
runs `scripts\fix-export.mjs`. That last step exists because Next 16 on Windows writes the small files the
browser prefetches into nested folders instead of the flat names it asks for. A build on Linux, such as the
one in the workflow, does not need it, and the script then does nothing.

Search works without a server. The build writes `out\search-index.json`; the browser downloads it once and
searches it locally.

### The path prefix

The site is a project site, so every URL starts with `/wax-docs`. The prefix comes from one environment
variable, `DOCS_BASE_PATH`, read in `next.config.mjs`:

| Situation | Prefix |
| --- | --- |
| `npm run dev` | none |
| `npm run build` with `DOCS_BASE_PATH` not set | `/wax-docs` |
| `DOCS_BASE_PATH` set | that value (an empty value means "served from the root") |

```powershell
$env:DOCS_BASE_PATH = '/other'    # or '' for a domain root
npm run build
npm run check
npm run serve
Remove-Item Env:DOCS_BASE_PATH
```

`npm run check` and `npm run serve` read the same variable, so keep it set while you run them.

Images are not optimised at request time (`images.unoptimized`), every page ends in a slash
(`trailingSlash`), and `public\.nojekyll` is copied into `out\`.

## Write a page

Pages are MDX files in `content\docs\`. The file path is the URL: `content\docs\gui\grid.mdx` is
`/docs/gui/grid`.

```mdx
---
title: Grid
description: One sentence that says what the page is for.
icon: Grid3x3
---

Text, then a complete example the reader can paste.
```

- `icon` is the name of a [Lucide](https://lucide.dev) icon, shown in the sidebar.
- The order of the sidebar is set by the `meta.json` in each folder. Add a new page there.
- Link to other pages with absolute paths: `[Tasks](/docs/tasks)`. The prefix is added for you.

### Screenshots

Screenshots are PNG files in `public\img\`. Show one with the `Shot` component, and give it alt text:

```mdx
<Shot src="toggle.png" alt="A window with two switches: God mode is on, Show hints is off." />
```

`Shot` reads the picture's size from the file, adds the path prefix, and never draws a picture wider than it
is. Put several inside `<ShotRow>` to show them side by side.

## The reference is generated

The pages in `content\docs\reference\` (except `index.mdx` and `meta.json`) are written by
`scripts\generate-api.mjs`. Do not edit them: they are overwritten.

The script reads the type definitions that give editors their completion list, `wax\types\*.lua` in the Wax
workspace, and turns their annotations into MDX:

| Type file | Page |
| --- | --- |
| `ui.lua` | `reference/ui` |
| `controls.lua` | `reference/controls` |
| `game.lua` | `reference/game` |
| `task.lua` | `reference/tasks` |
| `mod.lua` | `reference/mods` |
| `lua_basic.lua` | skipped (Lua's own standard library) |
| any other `.lua` file | a page named after the file |

| Annotation | Becomes |
| --- | --- |
| `---@class` with a table bound to a global (`ui = {}`) | A section named after the global, with its functions as `ui.Name(...)` |
| `---@class` that is a field of such a table (`ui.Icons`) | A section named `ui.Icons`, with its functions as `ui.Icons.Name(...)` |
| `---@class` with methods, signals, or a parent that has them | A section named after the type, with its functions as `window:Name(...)` |
| `---@class` with fields only | A table of fields. Classes named `...Options` get an "Option" table |
| `---@field` typed `WaxSignal<fun(...)>` | A row in the class's "Signal" table |
| `---@field` typed `fun(self: ...)` | A method of the class |
| `---@param`, `---@return`, `---@generic`, `---@overload` | The signature, the parameter table and the "Returns" line of a function |
| `---@alias`, with or without `---\|` lines | An entry under "Named values" |
| `---@deprecated` | A row in the page's last table (on the mods page: "Blocked functions") |
| The comment lines above any of these | Its description |

Type names in tables link to where the type is documented. Function names that appear in descriptions
(`ui.Color`, `Window:StatusBar`) become links too.

It runs by itself before `npm run dev` and `npm run build`. To run it alone:

```powershell
npm run generate
```

It prints what it could not use, and which classes and functions have no description.

The generated pages are committed. This repository does not contain `wax\types`, so here the script finds
nothing to read, says so, and leaves the committed pages as they are. To update the reference, run the
build in the Wax workspace (where this folder is `docs\` next to `wax\`) and commit the result. Set
`WAX_TYPES_DIR` to read the type files from somewhere else.

## Deploying

`.github\workflows\docs.yml` builds the site and deploys `out\` to GitHub Pages on every push to `main`. It
runs `npm ci`, `npm run build` and `npm run check` from the repository root, then uses the official Pages
actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`).

In the repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions** once.

## Layout

| Path | What |
| --- | --- |
| `content\docs\` | The pages, as MDX, and `meta.json` files for the sidebar order |
| `content\docs\reference\` | Generated reference pages (committed) |
| `public\img\` | Screenshots |
| `app\` | The Next.js routes: the home page, the docs layout, the search index |
| `components\` | The wordmark, the search dialog, `Shot` and the MDX component list |
| `lib\` | The content source and shared settings |
| `scripts\generate-api.mjs` | Writes the reference pages |
| `scripts\fix-export.mjs` | Runs after the build: puts prefetch files where the browser asks for them (needed on Windows only) |
| `scripts\check-links.mjs` | Checks the built site |
| `scripts\serve.mjs` | Serves the built site under the path prefix |
| `next.config.mjs` | Static export, path prefix, trailing slashes |
