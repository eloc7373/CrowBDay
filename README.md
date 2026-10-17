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

## Licensing notes

- All bundled tile art is generated procedurally by this app. No third-party art is included.
- Rules content (Phase 5) will use SRD 5.1 (CC-BY-4.0) or files you supply yourself. No Player's Handbook text ships with the app.
