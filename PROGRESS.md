# DM Toolkit — Progress

_Last updated: 2026-10-17 (Phase 6 implemented; not test-verified in this pass)_

> Working mode: the user asked for the remaining phases to be done without check-ins. Decisions the
> spec says to ask about are made here and listed under each phase's **Decisions** for review.

## Status by phase

| Phase | Scope                                                           | Status                        |
| ----- | --------------------------------------------------------------- | ----------------------------- |
| 0     | Scaffold, git, lint/format, test setup                          | ✅ Done                       |
| 1     | Map Creator core (canvas, grid, tools, layers, undo, shortcuts) | ✅ Done                       |
| 2     | Tilesets, props, asset library                                  | ✅ Done                       |
| 3     | Procedural generation                                           | ✅ Done                       |
| 4     | Export (PNG, PDF, JSON package, VTT notes)                      | ✅ Done                       |
| 5     | DM Board                                                        | ✅ Done (see Phase 5 section) |
| 5B    | Combat Mode (map ↔ initiative integration)                      | ✅ Implemented                |
| 6     | DM campaign workflow                                           | ✅ Implemented                |
| 7     | Polish & packaging                                              | 🚧 In progress                |

---

## Phase 5 — DM Board ✅

### Completed

- Draggable, resizable card board (react-grid-layout v2, layout saved to localStorage, "Reset layout"): combat tracker, conditions, session notes, rules browser and quick tools.
- Initiative tracker with ties, HP/temp HP, conditions and exhaustion; state persists in IndexedDB.
- Session notes with markdown, tags, pinning and 2 s autosave; notes can link to map room markers (`dmtk-room:<mapId>/<noteId>`). Clicking a link opens the map and centres the room.
- Rules browser and Ctrl+K / "/" search (Fuse.js) over the bundled original sample rules, conditions and any imported rules JSON.
- Quick tools: travel pace and typical DCs.

### Bugs fixed

- Leaving the Map Creator within 0.8 s of an edit lost it: the autosave stop function now flushes a pending save.
- Returning to the Map Creator re-ran `restoreLastMap()` and could overwrite newer in-memory edits: it now runs once per session.

### Test results

- Previous validation before manual-only combat: `npm test` 94/94; e2e 28/28; lint, formatting, typecheck and build clean. Current manual-combat and character changes are not verified yet.
- Lint, Prettier, typecheck and `npm run build` are clean. Both react-grid-layout CSS imports resolve.

### Open issues

- No separate "Pinned" section; pinned notes only sort first.
- The search palette lives in the app shell; rules data is not lazy-loaded. Map Creator chunk is about 990 kB (312 kB gzip).
- Room-link navigation was checked by code path and type check, not by an e2e test.

---

## Phase 5B — Combat Mode ✅ (stretch goals not done)

Built: linked tokens (combatant owns HP/AC/conditions; map draws them from it), HP bars and condition badges, active-creature highlight, movement tracking with walls and difficult terrain, area templates listing tokens inside, reach/range rings, batch damage with manually entered save outcomes, turn reminders and effect countdowns, concentration prompts, and combat log with undo. Combat is manual-entry only: dice are rolled outside the toolkit. The tracker highlights the next creature and records DM-entered turn notes. Logic is in `src/combat/`.

Decisions: the combatant is the source of truth once linked; movement routes the creature's top-left square only; template squares are picked by their centres; the log undoes combat state only, not map moves. Not done: player view window, line of sight and cover, fog of war.

Original plan (kept for reference):

Runs after Phase 5 (it needs the initiative tracker) and before Phase 6 polish. It mostly reuses data
the map already stores: tokens, walls, and the terrain movement/sight flags.

1. **Linked tokens.** Placing a creature token can add it to initiative. The active creature is
   highlighted on the map. Clicking a token selects its initiative row, and the reverse.
   _The token schema change for this is done in Phase 2 (see Phase 2 decisions)._
2. **HP and condition badges on tokens.** HP bar or ring, condition icons, and a "down" marker at 0 HP.
3. **Movement tracking.** Dragging the active token shows the path and feet used against its speed,
   counting difficult terrain. Turns red past the creature's speed.
4. **Area-of-effect templates.** Cone, sphere, cube, line and cylinder at a chosen size. Highlights
   the affected squares and lists the tokens inside.
5. **Reach and range rings** around the selected token.
6. **Batch damage.** Apply damage to several creatures at once, with an optional half for those who saved.
7. **Group rolls (not used in manual-only combat UI).** The DM rolls externally and enters outcomes.
8. **Turn reminders.** Start/end-of-turn prompts for conditions and effects, and duration
   countdowns in rounds.
9. **Automatic concentration prompt** when a concentrating creature takes damage, showing the DC.
10. **Combat log** of damage, healing, conditions and rolls, with undo.

Stretch goals: a player view (a second window showing only what players should see), line of sight
and cover estimates, and fog of war. Anything rules-based (template squares, cover, concentration DCs)
will be labelled as a DM aid and follow 2014 Player's Handbook wording. It must never be presented as an official
ruling.

## Phase 6 — DM campaign workflow ✅

Implemented local IndexedDB creature templates, reusable encounter rosters, session logs with links,
character records with initiative integration, party/quest/loot trackers, configurable undoable rest recovery, and campaign-only JSON backup and
merge import. The rest checklist is intentionally DM-controlled rather than asserting universal
edition-specific recovery rules. This phase has not been test-verified in this pass.

## Phase 0 — Scaffold ✅

- Vite 8 + React 19 + TypeScript 6 (strict) from `npm create vite@latest dm-toolkit -- --template react-ts`.
- Dependencies: konva, react-konva, zustand, dexie, react-router-dom, lucide-react (icons, bundled).
- Tailwind CSS v4 (`@tailwindcss/vite`), class-based dark mode, dark by default.
- ESLint (flat config: typescript-eslint, react-hooks, react-refresh) + Prettier.
- Vitest (unit) and Playwright (e2e, uses the locally installed Chrome via `channel: 'chrome'`).
- Git repo initialized on `main`.

Scripts: `dev`, `build`, `preview`, `lint`, `format`, `format:check`, `test`, `test:watch`, `test:e2e`, `typecheck`.

## Phase 1 — Map Creator core ✅

### Completed

- **Canvas:** Konva stage with cursor-centred wheel zoom (5%–800%). Pan with middle mouse, Space+drag, the Pan tool (H), or a two-finger trackpad. Pinch or Ctrl+wheel zooms.
- **Grid:** square grid, 70 px/cell default, configurable size, colour, opacity and visibility (Ctrl+G). Drawn in screen space and snapped to device pixels so lines stay crisp at every zoom. Fades out when cells are tiny. Map boundary is always drawn.
- **Scale:** feet per cell (default 5), shown in the status bar.
- **Status bar:** cursor cell (`C7` style), zoom %, px/cell, ft/cell, map size, active layer, status messages.
- **Tools:** Brush (size 1–8, Shift line, Alt eyedropper), Fill (map-bounded, optional "stop at walls"), Eraser (works on the active layer), Rectangle/Ellipse (fill or outline), Stamp (multi-cell footprints, R rotate, F mirror), Wall (on cell edges, door and secret-door modes, click an edge to convert, right-drag removes), Select & move (click, rubber band, Shift add, drag-move, Ctrl+D, Delete, arrow nudge, R/F on props), Measure (alternating 5/10, 5 ft, or Euclidean diagonals), Label/room marker (T), Pan.
- **Layers:** Terrain, Walls & Doors, Objects, Tokens, Notes. Fixed render order. Visibility, lock and opacity per layer. Locked or hidden layers refuse edits and say why.
- **Undo/redo:** reversible change lists, 200-entry cap, brush strokes and drags coalesced into one step, Escape cancels an in-progress stroke without a history entry.
- **Shortcuts:** all listed in the spec, plus T (label), 0 (fit), arrows (nudge), Shift+R. The `?` help dialog is generated from the same table the key handler uses.
- **Persistence:** current map autosaves to IndexedDB (Dexie) and restores on reload.
- Starter placeholder art (procedural): 9 terrain tiles, 8 props, 3 tokens.
- App shell: hash routing (`/map`, `/board`), light/dark toggle, per-route error boundaries, lazy-loaded route chunks.

### Acceptance results

| Criterion                                                                               | Result                                                                                                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create 30×20, paint terrain, stamp, wall with door, undo all to blank, redo all forward | ✅ e2e: document after undo deep-equals the blank map; after redo it deep-equals the final map                                                     |
| All keyboard shortcuts work and the help dialog lists them                              | ✅ e2e checks every tool key, `[` `]`, 1–5, Ctrl+G, R/F, Ctrl+D, Delete, Escape (including mid-stroke cancel), Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, `?` |
| Smooth pan/zoom with 1,000+ tiles                                                       | ✅ 2,000 tiles + 150 props + walls: avg 6.93 ms/frame, p95 7.1 ms (144 fps, the test display's refresh cap). 10,000 tiles: avg 6.94 ms, p95 7.7 ms |
| Undo test: 50 random edits → undo all → identical state                                 | ✅ unit test (`src/test/history.test.ts`)                                                                                                          |

### Test results

- `npm test`: **28/28 passed** (history/undo, geometry, shapes, wall edges, measure, flood fill, eraser, selection move/duplicate/rotate, stamp bounds).
- `npm run test:e2e`: **10/10 passed** (8 acceptance/behaviour + 2 performance).
- `npm run lint` and `tsc -b`: clean. `npm run build`: OK. `npm run preview` loads with no console errors and makes **no network requests outside localhost**.

### Decisions

1. **ESLint + Prettier instead of oxlint.** The current Vite template ships oxlint; the spec asks for ESLint + Prettier.
2. **React 19** (the template default; the spec says 18+). react-konva 19 matches.
3. **HashRouter**, so the static build works from any folder with no server rewrite rules.
4. **Data model** (`src/mapcreator/layers/model.ts`), already shaped like the Phase 4 package (`name, seed, grid, layers, tiles, walls, props, notes, createdAt, updatedAt`):
   - `tiles`: sparse `"x,y" → tileId` (terrain layer).
   - `walls`: unit cell edges keyed `h:x,y` / `v:x,y` → `{ door, secret }`. Thin, exact walls that are easy to diff, undo and export.
   - `props`: objects and tokens in one record with a `layer` field, plus rotation and mirroring.
   - `notes`: labels and numbered room markers. Room markers carry a number for linking to session notes in Phase 5.
5. **What's undoable:** content edits (tiles, walls, props, notes). Layer visibility/lock/opacity, grid display settings and the map name are persisted settings and are _not_ undo steps.
6. **Tool ↔ layer:** Brush, Fill, Rectangle and Ellipse paint terrain. Stamp goes to Objects (or Tokens for token assets). Wall uses Walls, Label uses Notes. Picking a tool switches the active layer. Eraser and Select act on whatever layer is active.
7. **`R` conflict:** the spec uses `R` for both the Rectangle tool and stamp rotation. While the Stamp tool is active (or props are selected) `R` rotates and Shift+R rotates the other way. Otherwise `R` picks Rectangle.
8. **Terrain rendering:** 16×16-cell offscreen chunk canvases, redrawn only when their tiles change. This is a manual form of Konva layer caching. 4 Konva layers in total (map, grid, tokens+notes, overlay).
9. **Wheel vs trackpad:** a heuristic treats large, purely vertical wheel deltas as a mouse wheel (zoom) and small or two-axis deltas as a trackpad (pan).
10. **Autosave** started in Phase 1 (Dexie is in the stack), so work isn't lost on refresh.

### Open issues / please verify

- ⚠️ **Diagonal default.** The spec says the "5e default" is alternating 5/10 ft, and I've used that as the default. To my knowledge, though, the Player's Handbook default is 5 ft per diagonal, and alternating 5/10 is an optional variant in the DMG. Both rules are available in the Measure tool. Please confirm which default you want.
- The wheel/trackpad heuristic may treat some high-resolution mouse wheels as trackpads (they'd pan instead of zoom). If that happens, I'll add an explicit setting.
- Maps over ~32M terrain pixels (e.g. 100×100 at 70 px) render terrain chunks at reduced resolution to cap memory. They look slightly soft when zoomed far in. Export (Phase 4) will render at full resolution separately.
- Select works on the active layer only (no cross-layer selection).
- No "open saved map" list yet; only the last map is restored. A map library arrives with JSON import/export in Phase 4.
- The tile art is a deliberately simple placeholder. (Edge-matching now exists for user tilesets; see Phase 2.)

## Phase 2 — Tilesets, props and assets ✅

### Completed

- **Catalogue (45 built-in assets, all procedural placeholder art):**
  - Terrain (12): stone floor, wood floor, dirt, grass, shallow/deep water, lava, ice, sand, rubble, mud, solid rock.
  - Dungeon (7): pit, chasm, bridge, stairs up, stairs down, altar (2×1), trapdoor.
  - Props (14): table (2×1), chair, barrel, crate, bed (1×2), bookshelf (2×1), pillar, statue, campfire, cart (2×1), tree (2×2), boulder, tent (2×2), chest.
  - Town (6): cobblestone, tavern (4×3 building), shop counter (3×1), market stall (2×2), well, fence.
  - Tokens (4): PC, ally, monster, NPC.
  - Every asset has id, name, category, footprint, `blocksMovement`, `blocksSight`, `difficultTerrain` and tags.
- **Flags stored in the map:** each map has an `assets` table holding the metadata and flags of every asset it uses. It is filled in automatically as part of the same undoable edit, and maps saved by Phase 1 are back-filled on load.
- **`tileset.json` format + loader** (`src/mapcreator/tilesets/tilesetFormat.ts`):
  - Grid settings: tile size (or width/height), columns/rows (measured from the image if omitted), margin and spacing.
  - Tile entries: named tiles by `index` or `col`/`row`, kind, category, multi-cell footprints, random variants, flags and tags.
  - Optional `edge4` autotile rules: the frame is picked from the N/E/S/W neighbour mask, and changing a cell redraws its neighbours.
  - Validation lists every error with its location, e.g. `tiles[0].index: 8 is outside the sheet (4 columns × 2 rows = 8 tiles, indices 0–7)`.
- **Import dialog:** drop a PNG (auto-sliced on a grid with a live preview; transparent cells are skipped; import cells as tiles, 1×1 props or tokens) or a PNG + `tileset.json`. Shows installed tilesets with a remove button. Tilesets persist in IndexedDB (Dexie v2 `tilesets` table) and reload on startup. If a tileset is removed, maps keep their layout and show a magenta placeholder.
- **Asset library panel:** ranked search over names, tags, category and source; category, tag and source filters; a recently-used row (persisted per browser); click to arm Brush or Stamp; drag onto the canvas (tiles paint the cell, props and tokens are stamped centred on it); flag info in tooltips.
- **Tokens (pulled forward for Combat Mode):** optional creature data on tokens: name, side, size, HP (current/max/temp), AC, speed, initiative bonus, conditions, hidden. Size sets the footprint (Large 2×2, Huge 3×3, Gargantuan 4×4). Tokens are auto-numbered ("Monster 1"), and the Stamp tool has a creature-size picker. Selecting a token opens the **Token panel**, with quick Damage/Heal (damage uses up temporary HP first). Rendering shows initials, an HP bar with a temp-HP strip, a red cross at 0 HP, and hidden tokens faded with a dashed ring. All edits are undoable.
- `docs/tileset-example.json` and a README section "Adding a tileset" (CC0/permissive sources listed, nothing bundled).

### Acceptance results

| Criterion                                                                     | Result                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All categories populated with placeholder art                                 | ✅ unit test checks every asset named in the spec; e2e checks each category's count and that thumbnails render                                                                      |
| Dropping a custom tileset PNG via the import dialog makes its tiles available | ✅ e2e: a PNG generated in the browser is imported through the dialog, its 7 non-empty cells become searchable tiles, one is painted, and both the tileset and map survive a reload |
| Searching "stone" returns the stone floor and related tiles                   | ✅ unit + e2e: Stone floor ranks first, followed by rubble, rock, pillar, cobblestone, statue, …; grass is excluded                                                                 |

### Test results

- `npm test`: **43/43 passed** (adds catalogue, search, tileset parsing incl. margin/spacing/variants/footprints/autotile/error messages, registry replace/remove, asset metadata undo, legacy back-fill, token footprints and initials).
- `npm run test:e2e`: **17/17 passed** (Phase 1 suite + 7 Phase 2 tests: categories, search, PNG import + reload, tileset.json import, invalid JSON errors, drag-and-drop + recently used, token data + undo). Performance unchanged: 144 fps at 2,000 and 10,000 tiles.
- Lint and type-check clean.

### Decisions

1. **Schema changes made now, while they're cheap** (the spec asks to check before changing the schema after Phase 2):
   - `PlacedProp.token?: TokenInfo` holds creature data on the token. Combat Mode will link initiative entries to token ids, so HP lives in one place and HP edits are undoable map edits.
   - `MapDoc.assets: Record<assetId, AssetMeta>` stores the movement/sight flags needed for export.
2. Asset art is a union: `procedural` (built-in) or `image` frames from a sprite sheet. Custom asset ids are namespaced `tilesetId:tileId`, and the tileset id is the slugified name. Re-importing a tileset with the same name replaces it.
3. Flags on built-ins follow common table conventions: pits and chasms block movement but not sight; ice, mud, rubble and water are difficult terrain; lava is tagged `hazard` and does not block movement. These are DM aids, not rules.
4. The well appears once, under Town (the spec lists it under both Props and Town). Tags make it findable from either.
5. Search is a small ranked matcher rather than Fuse.js: it's predictable for short asset names and needs no dependency. Fuse.js will be used for the DM Board rules search as the spec says.
6. Tokens never rotate or mirror; their footprint comes from creature size.

### Open issues

- Autotile supports only the 16-mask `edge4` mode (no 47-tile "blob" corners). Map edges count as non-matching neighbours.
- Custom sprites are scaled to the map's cell size with smooth interpolation. Pixel-art sheets may look soft when zoomed in, so a `pixelArt` option could be added.
- The asset library shows at most 200 results at once (with a note); very large sheets should be narrowed with search.

## Phase 3 — Procedural generation ✅

### Completed

- **Generate dialog** (toolbar "Generate"): choose Cave, Dungeon, Tavern / building or Village / town; edit its parameters with a live preview; enter or roll a **seed** (dice button) and **copy** it. The current map's seed is shown in the top bar with a copy button.
- **Merge modes:** _Replace_ resizes the map to the result and replaces all content. _Overlay_ draws the result from the top-left, clipped to the current map, and continues room numbers after existing markers. Either way it is **one undo step**, including the map size and seed.
- **Cave** (cellular automata, `generation/cave.ts`): width, height, fill % (default 45), smoothing passes (default 4), minimum cave size, connect-all toggle. Tunnels join each remaining cave to the nearest connected one. Output: dirt floor with a sprinkle of rubble, rock terrain, and walls on every floor/rock boundary.
- **Dungeon** (BSP, `generation/dungeon.ts`): width, height, min/max room size, corridor width 1 or 2, door probability, 0–3 secret doors, stairs toggle. Each split is joined by an L-shaped corridor between its closest rooms, so all rooms connect. Doorways where corridors meet rooms get a door or stay open; secret doors are picked among them. Rooms are numbered by walking distance from the entrance (room 1 = "Entrance") and get room-marker notes. Stairs go up at the entrance and down in the farthest room.
- **Tavern / building** (`generation/tavern.ts`): room count 1–6, footprint, bar counter, hearth, tables. A common room at the front, with side rooms (kitchen, storage, bedrooms, office) each having a door into it. Front door onto a cobbled street; furniture is placed without overlaps.
- **Village / town** (`generation/village.ts`): block count, main road width, building density. A grid of blocks with cobbled main streets, a plaza with a well, dirt side paths through each block, and lots with buildings (walls, door facing the path, a little furniture, numbered/named markers such as Tavern, Smithy, Temple), trees or fenced gardens.
- All generators are pure `(params, seed) → GenResult` functions using the seeded RNG (`lib/rng.ts`, mulberry32 + FNV hash; namespaced per generator).

### Acceptance results

| Criterion                                                     | Result                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same seed + params → identical output; different seeds differ | ✅ unit test for all 4 generators (plus "different params differ"); e2e generates the same dungeon twice from a typed seed and compares tiles and walls |
| Dungeon: flood fill from the entrance reaches every room      | ✅ unit test over 25 seeds × both corridor widths with 3 secret doors (doors passable, walls not); also checks no rock cell is reachable                |
| Generate-then-undo returns the map to its prior state         | ✅ unit test for all 4 generators × replace/overlay (deep-equal after undo); e2e confirms with Ctrl+Z                                                   |

### Test results

- `npm test`: **64/64 passed** (adds 21 generation tests: determinism, reachability, secret doors and stairs, room-size limits, cave connectivity and minimum size, tavern rooms/furniture/reachability, village streets/buildings/doors, merge + undo for every generator and mode).
- e2e: **2 new tests passed** (seeded dungeon + undo + reproduce; every generator applies in overlay mode).

### Decisions

1. Map `width`/`height` became undoable metadata so a _Replace_ generation, including its resize, is a single undo step.
2. Dungeons and caves fill non-floor with the "Solid rock" tile (blocks movement and sight), so exports carry correct flags. Doors use the existing wall-edge door flags.
3. A corridor running _alongside_ a room (rather than entering it) is left open instead of getting a door. This keeps every room reachable without strange long doors.
4. In _Overlay_ mode, generated content is anchored at the map's top-left and clipped. Placing it at an arbitrary offset is a possible later addition.
5. "Tables" in the tavern controls the common room only; side rooms (e.g. the kitchen) keep their own furniture.

### Open issues

- The cave generator uses a sampled closest-pair search on very large maps when tunnelling, so tunnels are near-shortest rather than guaranteed shortest.
- Village buildings are single-room interiors.

## Phase 4 — Export ✅

### Completed

- **PNG export (VTT-ready)**, Export → Image:
  - Options: cell size (default = map cell size), 1×/2× scale, background colour or transparent, grid, walls & doors, objects, tokens (off by default; hidden tokens never exported), notes/room numbers (off), secret doors shown or drawn as plain wall (player copy), and a fog-of-war placeholder (a matching black mask PNG). The dialog shows the output size and filename, and blocks sizes browsers can't create.
  - **Grid-aligned:** exact integer px per cell, A1 at pixel (0,0), no padding. Grid lines are pixel rectangles starting at multiples of the cell size. The maths is documented at the top of `export/layout.ts`.
  - Filename: `{map-name}_{width}x{height}_{cell}px.png`.
- **Print PDF** (jsPDF), Export → Print: Letter, A4 or custom (mm), margin, orientation chosen automatically, map scaled to fit on white, title, "1 square = 5 ft · mm per square", and a scale bar in feet with one segment per square.
- **Map package JSON:** versioned `{ format: "dmtk-map", version: 1, id, name, seed, width, height, grid, layers, tiles, walls, props, notes, assets, createdAt, updatedAt }`.
  - JSON Schema in `src/data/map-package.schema.json`, validated with Ajv on import, plus bounds and id checks the schema can't express. Errors read like `props.x.rotation: must be one of 0, 90, 180, 270.`
  - `migratePackage()` has a migration table (empty for now), refuses files from newer versions, and accepts files without `assets`.
- **Maps dialog** (map library): lists every map saved in this browser, with open and delete, plus "Import map file…". Importing never overwrites a saved map: if the id exists, the map comes in as "… (imported)".
- **Foundry scene JSON (experimental stretch goal):** collinear wall edges are merged into segments; doors map to Foundry doors and secret doors to secret doors; grid size and distance are filled in. Marked "verify in your Foundry version".
- **`docs/vtt-export.md`:** Foundry, Roll20 and Owlbear Rodeo import steps, general tips and printing notes, with uncertain menu details marked "verify in current version".

### Acceptance results

| Criterion                                                               | Result                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A 30×20 map at 70 px exports at exactly 2100×1400 at 1×                 | ✅ unit (layout) + e2e: the downloaded PNG's header says 2100×1400; 2× gives 4200×2800 at 140 px                                                                                                        |
| Round-trip export JSON → import JSON → identical map (deep equal)       | ✅ unit: a generated dungeon with tokens, layer and grid settings round-trips through `JSON.stringify` → `parsePackage` deep-equal; e2e: export via the UI, import into another map, contents identical |
| PNG test checks dimensions and grid lines on multiples of the cell size | ✅ e2e decodes the exported PNG and samples pixels: black at x = 0, 70, 140, 700, 2030 and the right/bottom edges; white at 35, 69, 71, 105, 2065. Unit test checks `gridLineOffsets`                   |

### Test results

- `npm test`: **75/75 passed** (adds 11 export tests: sizes and filenames, grid offsets, canvas limits, PDF fit and scale bar, JSON round-trip, validation messages, bounds/id checks, migration, Foundry wall merging and pixel coordinates).
- e2e: **4 new tests passed** (PNG dims + pixel grid check, JSON round-trip via UI, invalid file errors, PDF header + Foundry walls).

### Decisions

1. The package adds `format`, `id`, `width`, `height` and `assets` to the fields listed in the spec. Width and height are required to place anything; `assets` carries the movement/sight flags.
2. Exports skip layers that are hidden in the editor and respect layer opacity.
3. The PDF rasterises the map at about 200 dpi for the printed size (an integer px per cell, capped at 140).
4. Custom tileset images are not embedded in the map JSON (it would bloat files). Missing art shows as a placeholder until the tileset is re-imported. This is noted in the dialog and the docs.

### Bug fixed during this phase

- **Autosave could lose recent edits when switching maps.** Creating, opening or importing another map within 0.8 s of an edit dropped the previous map's last changes, because only the newest document was saved after the debounce. The outgoing map is now saved immediately when the map changes. (Found by the round-trip e2e test.)

### Open issues

- Multi-page, true 1-inch battle-mat printing is not implemented.
- Foundry export covers walls and doors only (no lights or tokens) and has not been tested in a real Foundry install. **Please verify it.**
