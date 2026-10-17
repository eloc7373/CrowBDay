# DM Toolkit

An offline web app for running D&D 5th Edition sessions:

- **Map Creator**: a grid-based battle/dungeon/town map editor with VTT-friendly export (export arrives in Phase 4).
- **DM Board**: rules lookup, conditions, initiative, notes and dice (Phase 5).

No backend, no accounts, no analytics. Everything is stored locally in your browser (IndexedDB).

> Work in progress. See [PROGRESS.md](PROGRESS.md) for what's done and what's next.

## Requirements

- Node.js 20+ (developed on Node 24)
- For e2e tests: Google Chrome installed (Playwright uses it via `channel: 'chrome'`, so no browser download is needed)

## Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static build in dist/
npm run preview      # serve the build locally
npm test             # unit tests (Vitest)
npm run test:e2e     # browser tests (Playwright; starts the dev server)
npm run lint         # ESLint
npm run format       # Prettier
```

## Map Creator quick start

Press `?` in the Map Creator for the full shortcut list.

| Key                         | Tool                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| B / G / E                   | Brush / Fill / Eraser                                                 |
| R / O                       | Rectangle / Ellipse (R rotates while stamping)                        |
| S                           | Stamp props and tokens (R rotate, F mirror)                           |
| W                           | Walls on cell edges. Door and secret-door modes are in the side panel |
| V                           | Select & move (Ctrl+D duplicate, Delete)                              |
| M                           | Measure in squares and feet                                           |
| T                           | Text label / numbered room marker                                     |
| H, Space+drag, middle mouse | Pan                                                                   |
| Wheel                       | Zoom at cursor                                                        |

Defaults: 70 px per cell, 5 ft per cell.

### Asset library

The right-hand panel lists every tile, prop and token. Type to search names and tags (try
"stone"), filter by category, tag or source, then click an asset to arm the right tool or drag
it straight onto the map. Your recently used assets are shown at the top.

Select a token with the Select tool (V) to give it a name, size (Large is 2×2 and so on), HP,
AC, speed, initiative bonus and conditions. You can also apply quick damage or healing, which
uses up temporary HP first. All of these edits can be undone.

## Adding a tileset

The built-in art is a simple procedural placeholder. To use real art, open **Asset library →
Import tileset** and drop in a PNG sprite sheet laid out on a grid.

**Quick way: PNG only.** Choose the sheet, then set the tile size (plus margin and spacing if
the sheet has gaps). Every non-transparent cell becomes a terrain tile, 1×1 prop or token, named
after the sheet.

**Full control: PNG + `tileset.json`.** Drop both files together. The JSON names each tile and
sets its movement and sight flags, multi-cell props, random variants and edge-matching rules.
See [`docs/tileset-example.json`](docs/tileset-example.json) for a complete example.

| Field                                               | Meaning                                                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                              | Tileset name (also its id, e.g. "Example Dungeon" → `example-dungeon`)                                                              |
| `tileSize` or `tileWidth` + `tileHeight`            | Size of one grid cell in the sheet, in px                                                                                           |
| `columns`, `rows`                                   | Grid size (optional: measured from the image if omitted)                                                                            |
| `margin`, `spacing`                                 | Border around the sheet and gap between cells, in px                                                                                |
| `license`, `author`, `url`                          | Shown in the tileset list. Keep a record of where the art came from                                                                 |
| `defaults`                                          | Values applied to every tile entry (e.g. `kind`, `category`)                                                                        |
| `tiles[]`                                           | Optional. If omitted, every non-empty cell is imported                                                                              |
| `tiles[].id`                                        | Letters, digits, `-` and `_`. Becomes `tilesetId:id` in maps                                                                        |
| `tiles[].index` or `col` + `row`                    | Position in the sheet (row-major from 0)                                                                                            |
| `tiles[].kind`                                      | `tile` (terrain), `prop` (stamp) or `token`                                                                                         |
| `tiles[].category`                                  | `terrain`, `dungeon`, `props`, `town` or `tokens`                                                                                   |
| `tiles[].footprint`                                 | `[w, h]` in cells for props; the sprite spans that many sheet cells                                                                 |
| `tiles[].variants`                                  | Extra sheet indices picked at random per cell (tiles)                                                                               |
| `blocksMovement`, `blocksSight`, `difficultTerrain` | Stored in the map and included in exports                                                                                           |
| `tags`                                              | Search keywords                                                                                                                     |
| `autotile[]`                                        | Edge matching: `{ tile, matches, masks }`. A mask counts matching neighbours as N=1, E=2, S=4, W=8 (0–15) and maps to a sheet index |

If something is wrong, the import dialog lists each problem with its location (for example,
`tiles[3].index: 40 is outside the sheet (8 columns × 4 rows = 32 tiles, indices 0–31)`) and
nothing is installed. Installed tilesets are stored in your browser. Maps that use a removed
tileset keep their layout and show a placeholder until you import it again.

**Where to find art.** These sites have permissively licensed tiles you can use. They are not
bundled with the app, so download them yourself and check each pack's licence:

- [Kenney.nl](https://kenney.nl/assets): CC0 packs (e.g. "Roguelike/RPG pack", "Tiny Dungeon")
- [OpenGameArt.org](https://opengameart.org/): mixed licences. Filter by CC0 or CC-BY and credit the authors
- [itch.io free asset packs](https://itch.io/game-assets/free/tag-tileset): check each pack's licence

## Licensing notes

- All bundled tile art is generated procedurally by this app. No third-party art is included.
- Rules content (Phase 5) will use SRD 5.1 (CC-BY-4.0) or files you supply yourself. No Player's Handbook text ships with the app.
