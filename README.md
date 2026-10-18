# DM Toolkit

An offline web app for running D&D 5th Edition sessions:

- **Map Creator**: a grid-based battle/dungeon/town map editor with VTT-friendly export.
- **DM Board**: rules lookup, conditions, manual initiative/combat tracking and notes.
- **Showcase**: an interactive, no-audio product tour. Edit map tiles, advance combat, and save a sample player sheet without changing campaign data; open the live Map Creator or DM Board from any scene. Download the shareable MP4 from the Showcase page (`public/dm-toolkit-showcase.mp4`).

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

## Generating and exporting maps

- **Generate** (toolbar): cave, dungeon, tavern/building or village/town from a seed. The same seed and settings always give the same map. The seed is shown in the toolbar with a copy button. Generating is one undo step.
- **Export** (toolbar): grid-aligned PNG for VTTs (each cell is an exact number of pixels; the filename says how many), print-ready PDF with a scale bar, the full map as a `.dmtk-map.json` file, or an experimental Foundry VTT scene with walls. See [docs/vtt-export.md](docs/vtt-export.md) for importing into Foundry, Roll20 and Owlbear Rodeo.
- **Maps** (toolbar): every map saved in this browser, plus import of `.dmtk-map.json` files. The file format is defined by [src/data/map-package.schema.json](src/data/map-package.schema.json).

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

## DM Board

Open **DM Board** in the top bar. Cards can be dragged and resized; **Reset layout** restores the default.

- **Initiative**: add creatures (or quick-add generic monsters), then press Next. State survives a refresh.
- **Monster & player options**: import a personal JSON compendium, search monsters and player features together, and add monsters directly to initiative. Imported entries stay in this browser's IndexedDB.
- **Combat**: enter initiative and battle results manually; the turn tracker highlights who's acting and who's next, and the combat log records turns, map movement, damage, healing, conditions, and DM-entered action notes. Roll dice outside the toolkit.
- **Session notes**: markdown, autosaved every 2 s. Use "Link a map room" to insert a link that opens the map and centres that room marker.
- **Rules**: press Ctrl+K or `/` to search. The bundled rules are original placeholder summaries.
- **Importing rules**: Rules → Import rules JSON, using `{ "name", "notice", "entries": [ ... ] }`. The entry format is in `src/data/srd/README.md`. Imported content stays in your browser.
- **Campaign**: save reusable creature templates, encounter rosters, dated session recaps, player character sheets, quests and loot. Character sheets include identity, ability scores, proficiencies, combat resources, equipment, features and spells, and can be edited or added to initiative. Session logs can link to notes, map rooms, campaign records and encounters. Rest recovery is a DM-controlled, undoable checklist; it does not enforce edition-specific rest rules.
- **Campaign backup**: use JSON / Import in the Campaign card to export or merge campaign templates, encounters, sessions and records. Data remains in this browser's IndexedDB; backups do not include maps, tilesets, rules or standalone session notes.

The compendium's JSON format is documented in [docs/compendium-json.md](docs/compendium-json.md). The app does not bundle material from the Player's Handbook or Monster Manual; import personal-use data you have prepared, or use SRD data under its license.

Personal use only: if you import text from a book you own (e.g. the Player's Handbook), it stays in your browser and must not be redistributed. SRD 5.1 content is CC-BY-4.0; if you add it, include the SRD attribution statement.

## Licensing notes

- All bundled tile art is generated procedurally by this app. No third-party art is included.
- Rules content (Phase 5) will use SRD 5.1 (CC-BY-4.0) or files you supply yourself. No Player's Handbook text ships with the app.
