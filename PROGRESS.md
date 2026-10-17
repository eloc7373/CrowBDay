# DM Toolkit — Progress

_Last updated: 2026-10-17 (end of Phase 1)_

## Status by phase

| Phase | Scope                                                           | Status                                  |
| ----- | --------------------------------------------------------------- | --------------------------------------- |
| 0     | Scaffold, git, lint/format, test setup                          | ✅ Done                                 |
| 1     | Map Creator core (canvas, grid, tools, layers, undo, shortcuts) | ✅ Done (awaiting review)               |
| 2     | Tilesets, props, asset library                                  | ⏳ Not started                          |
| 3     | Procedural generation                                           | ⏳ Not started                          |
| 4     | Export (PNG, PDF, JSON package, VTT notes)                      | ⏳ Not started                          |
| 5     | DM Board                                                        | ⏳ Not started (placeholder route only) |
| 5B    | Combat Mode (map ↔ initiative integration)                      | ⏳ Planned (added 2026-10-17)           |
| 6     | Polish & packaging                                              | ⏳ Not started                          |

---

## Phase 5B — Combat Mode (planned, approved 2026-10-17)

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
7. **Group rolls.** Roll initiative or a save for a whole group, each result applied to its own row.
8. **Turn reminders.** Start/end-of-turn prompts for conditions and effects, and duration
   countdowns in rounds.
9. **Automatic concentration prompt** when a concentrating creature takes damage, showing the DC.
10. **Combat log** of damage, healing, conditions and rolls, with undo.

Stretch goals: a player view (a second window showing only what players should see), line of sight
and cover estimates, and fog of war. Anything rules-based (template squares, cover, concentration DCs)
will be labelled as a DM aid and follow SRD 5.1 wording. It must never be presented as an official
ruling.

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
- The tile art is a deliberately simple placeholder. Edge-matching/autotile comes in Phase 2.

### Next steps (Phase 2)

- Full tile/prop catalogue (all categories in spec §3.2) with placeholder art.
- `tileset.json` format and loader (tile size, columns, rows, named tiles, autotile rules) plus a PNG import dialog.
- Searchable/filterable asset library with drag-to-canvas and a recently-used list.
- README section on adding tilesets (CC0 sources: Kenney.nl, OpenGameArt; not bundled).
