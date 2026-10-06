# Wax documentation

This folder is the documentation site for Wax, a Lua scripting framework for ICARUS. It is a
[Fumadocs](https://fumadocs.dev) site on Next.js. It builds to static files, and GitHub Pages serves them as
a project site under the path `/wax-docs`.

The live site is at https://wax-icarus.duckdns.org/.

Wax is an early version. The site says so on the home page, on the first docs page and on the install page.

## Run it

You need Node 20.9 or newer. The workflow uses Node 24.

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

`npm run serve` behaves like GitHub Pages for a project site. Everything is under a path prefix, a folder
without a trailing slash redirects, and a missing page gets `404.html`. To change the port or the prefix, pass
`--port 5000` or `--base /other` after `--` (`npm run serve -- --port 5000`).

`npm run build` does three things in a row:

1. It regenerates the Explorer's data, the reference and the icon list (see below).
2. It runs `next build`.
3. It runs `scripts\fix-export.mjs`.

The third step is needed on Windows only. There, Next 16 writes the small files the browser prefetches into
nested folders, and the browser asks for flat names. On Linux, as in the workflow, the script does nothing.

Search works without a server. The build writes `out\search-index.json`. The browser downloads it once and
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

Images are not optimised at request time (`images.unoptimized`). Every page ends in a slash
(`trailingSlash`). `public\.nojekyll` is copied into `out\`.

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
- The `meta.json` in each folder sets the order of the sidebar. Add a new page there.
- Link to other pages with absolute paths: `[Tasks](/docs/tasks)`. The prefix is added for you.

### Pages that name the download

`content\docs\install.mdx` names the download `Wax-0.1.1.zip` and links to
https://github.com/bostonstrong567/icarus-wax/releases/latest. The version comes from `wax\VERSION` in the Wax
workspace. Change the file name on that page when the version changes.

`content\docs\editor.mdx` describes the VS Code extension, "Wax for Icarus" (`RobertCincotta.wax-icarus`).

### Screenshots

Screenshots are PNG files in `public\img\`. Show one with the `Shot` component, and give it alt text:

```mdx
<Shot src="toggle.png" alt="A window with two switches: God mode is on, Show hints is off." />
```

`Shot` reads the picture's size from the file, adds the path prefix, and never draws a picture wider than it
is. Put several inside `<ShotRow>` to show them side by side.

## The reference is generated

`scripts\generate-api.mjs` writes the pages in `content\docs\reference\`, except `index.mdx` and `meta.json`.
Do not edit those pages. The script overwrites them.

The script reads the type definitions that give editors their completion list. They are `wax\types\*.lua` in
the Wax workspace. It turns their annotations into MDX:

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

The script runs by itself before `npm run dev` and `npm run build`. To run it without building:

```powershell
npm run generate
```

That runs all three generators: the Explorer's data, this one and the icon list below. This one prints what it
could not use, and which classes and functions have no description.

Three things in the type files are read in a special way:

- A parameter typed in backticks, as in ``---@param class_name `T` ``, is a class name given as text. The page
  shows it as a `string`.
- With `---@generic T : WaxInstance` above it, the result typed `T?` is shown as `WaxInstance?`, with the words
  "An Instance of that class".
- A class that extends `table` is shown without a parent.

Only the `.lua` files directly in `wax\types` are read. The `icarus` folder there holds the game's classes for
the editor. The site shows those from the game index (see the Explorer page below).

Every section and every function on a reference page ends with an "Open in the Explorer" link
(`components\in-explorer.tsx`). A game class named on a reference page, such as `IcarusPlayerController`, links
to that class in the Explorer. That goes for a type in a table and for a class named in a description. In a
description only names that look like class names are linked (two words run together, or words joined by
underscores, plus `Actor`, `Pawn` and `Object`), and never a name that Wax uses itself, such as `GameState`.

The generated pages are committed. The published repository does not contain `wax\types`. There the script
finds nothing to read, says so, and leaves the committed pages as they are. To update the reference, run the
build in the Wax workspace (where this folder is `docs\` next to `wax\`) and commit the result. Set
`WAX_TYPES_DIR` to read the type files from somewhere else.

## The Explorer page

`/explorer` searches and browses two things in one place: what Wax gives a mod, and the classes of the game.
It runs in the browser. Nothing on it needs a server.

| What | Made by | From | Kept in |
| --- | --- | --- | --- |
| Wax's own API | `scripts\generate-api.mjs` | `wax\types\*.lua` | `lib\explorer-wax.json` (part of the page's script) |
| The game's types | `scripts\generate-explorer.mjs` | `build\game-index\site\` in the Wax workspace | `public\explorer-data\` |

`build\game-index\site\` is written by `python scripts\gameindex.py site` in the Wax workspace. It is not in
git, so `generate-explorer.mjs` copies what the page needs and the copy is committed. Without the folder the
script says so and keeps the copy. Set `GAME_INDEX_DIR` to read the index from somewhere else. After a game
update, run `gameindex.py site`, then `npm run generate`, and commit `public\explorer-data\`.

| File in `public\explorer-data\` | What it holds | When the page fetches it |
| --- | --- | --- |
| `search.json` | Every type's name, kind and chunk. A copy of the index's own file. | On every visit |
| `tree.json` | Each type's parent, the date of the index, and the other names a type goes by. Worked out from the chunks. | On every visit |
| `members.json` | Member names, apart as properties, functions and delegates, each with the types that have it. Worked out from the chunks. | When a search first needs it |
| `chunks\*.json` | Each type's properties and functions. Copies of the index's own files. | One file, when a type in it is opened |

The index's own `members.json` does not say whether a member is a property or a function, so the script makes
its own. The script stops with an error when the index and its chunks do not agree, or when the index has a
format number it does not know. It also prints the type names that are mentioned and are not in the index.

How the page works:

- `lib\explorer.ts` holds the logic and no React: the search and its ranking, the links inside a type, and the
  "In a script" examples for the game's members. `components\explorer.tsx` draws it.
- The address bar follows the page: `?q=` is the search, `?kind=` and `?from=` are the filters, `?wax=ui.Notify`
  opens an entry of Wax and `?game=Actor.K2_GetActorLocation` one of the game. A link shows the same view.
- A search puts exact names first, then names that start with what was typed, then names with a word that
  starts with it. Among equal matches Wax comes before the game.
- The example for a game member goes through the member of `game` that is of that class (`game.Character`,
  `game.World` and so on, as `wax\types\game.lua` types them). Other classes use `game:Find`.
- A function the index marks `oversized` is shown as one that cannot be called from Lua, without an example.
- The index was read at the game's title screen. Blueprint classes that only load inside a prospect are not in
  it, and the page says so.

Which guide page a Wax entry links to is set at the top of `scripts\generate-api.mjs` (`GUIDES`,
`MEMBER_GUIDES`). The groups the page lists are `GROUPS` in the same file.

## The Icons page

`/icons` shows every icon that comes with Wax. A click copies the icon's name.

`scripts\generate-icons.mjs` makes what the page needs from two files of the Wax runtime:

| From `wax\runtime\` | To |
| --- | --- |
| `Scripts\wax\gui\icons_list.lua` (the names, in order) | `lib\icon-names.json` |
| `assets\lucide\sheet32.png` (all icons on one image, 40 per row, 32 pixels each) | `public\lucide\sheet32.png` |
| `assets\lucide\LICENSE.txt` | `public\lucide\LICENSE.txt` |

The script runs before `npm run dev` and `npm run build`. The three files it writes are committed, for the
same reason as the reference pages. Without the runtime the script says so and keeps them. Set
`WAX_RUNTIME_DIR` to read the runtime from somewhere else.

The icons on the sheet are white. The page uses the sheet as a mask and fills it with the text colour, so the
icons show in the light theme and in the dark theme (`.sheet-icon` in `app\global.css`). The grid only draws
the rows that are in view.

## The Mods page

`/mods` lists the mods in the Wax mod catalogue. It runs in the browser and asks the catalogue service for
everything it shows. The address of the service is `marketApi` in `lib\shared.ts`. It is a full address
because the GitHub Pages copy of the site is on another host.

The page uses these routes of the service: `/mods`, `/mods/:id`, `/mods/:id/download/:version`, `/categories`
and `/tags`. In the Wax workspace they are described in `wax\market\README.md`.

Each mod has two actions. **Add to game** is a link to `wax://install/<id>`, with the mod's id as the
catalogue gives it. Wax registers that address on the player's PC when it is installed, and its helper fetches
the mod and puts it in the game. The page does not check whether the address is registered. **Download zip** is
a link to the newest zip.

The search, the filters, the sort order, the page number and the open mod are kept in the address bar
(`?q=`, `?category=`, `?tag=`, `?sort=`, `?page=`, `?mod=`), so a link shows the same view.

Two things to know when it shows "The mod catalogue cannot be reached right now.":

- The service allows other sites to call it only when they are listed in its `WAX_MARKET_ORIGINS` setting.
  The GitHub Pages copy needs `https://bostonstrong567.github.io` there.
- To try the page against a catalogue on your own machine, start the service with `WAX_MARKET_ORIGINS=*`,
  point `marketApi` at it (`http://127.0.0.1:8087/api`), build, and put the address back afterwards.

## Deploying

`.github\workflows\docs.yml` builds the site and deploys `out\` to GitHub Pages on every push to `main`. It
runs `npm ci`, `npm run build` and `npm run check` from the repository root. Then it uses the official Pages
actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`).

In the repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions** once.

## Layout

| Path | What |
| --- | --- |
| `content\docs\` | The pages, as MDX, and `meta.json` files for the sidebar order |
| `content\docs\reference\` | Generated reference pages (committed) |
| `public\img\` | Screenshots |
| `public\lucide\` | The icon sheet and its licence (generated, committed) |
| `public\explorer-data\` | The game's types for the Explorer (generated, committed) |
| `app\` | The Next.js routes: the home page, the Explorer, Mods and Icons pages, the docs layout, the search index |
| `components\` | The wordmark, the search dialog, `Shot`, the Explorer, the mod browser, the icon browser and the MDX component list |
| `lib\` | The content source, shared settings, the Explorer's logic, and `icon-names.json` and `explorer-wax.json` (generated, committed) |
| `scripts\generate-api.mjs` | Writes the reference pages and `lib\explorer-wax.json` |
| `scripts\generate-explorer.mjs` | Copies the game index into `public\explorer-data\` |
| `scripts\generate-icons.mjs` | Writes the icon list and copies the icon sheet |
| `scripts\fix-export.mjs` | Runs after the build: puts prefetch files where the browser asks for them (needed on Windows only) |
| `scripts\check-links.mjs` | Checks the built site |
| `scripts\serve.mjs` | Serves the built site under the path prefix |
| `next.config.mjs` | Static export, path prefix, trailing slashes |
