# Using exported maps in a virtual tabletop

DM Toolkit exports **grid-aligned** PNGs:

- Every cell is exactly _N_ whole pixels (shown in the Export dialog, e.g. **70 px per cell**).
- Cell A1 starts at pixel (0, 0). There is no border or padding.
- Image size = cells × N. A 30×20 map at 70 px is 2100 × 1400 px; at 2× it is 140 px per cell, 4200 × 2800 px.
- The filename records the numbers you need: `crypt_30x20_70px.png` means 30 × 20 cells at 70 px each.

So in any VTT the rule is the same: **set the grid size to the exported px-per-cell, and one square to
5 ft** (or whatever "feet per cell" your map uses). Don't crop or resize the image in another
program, or the grid stops lining up.

> Claims marked **(verify in current version)** come from how these VTTs worked when this was written.
> Menus move between releases, so check them against the version you use.

## General tips

- **Grid lines:** most VTTs draw their own grid. Export with **Grid** unticked to avoid double lines,
  or keep it for a printed or "baked-in" look.
- **Tokens** are not exported by default. Use the VTT's own tokens. Hidden tokens are never exported.
- **Secret doors** export as plain wall unless you tick "Show secret doors" (do that for a DM copy only).
- **Room numbers / notes** are DM information and are off by default.
- **File size:** a 2× export of a large map can be tens of megabytes. Some VTTs limit uploads, so
  use 1×, or convert to WebP or JPEG _without resizing_.
- **Fog placeholder:** ticking "Fog of war placeholder" also downloads a solid black PNG of the same
  size. Use it only if your VTT supports image-based fog. Most have built-in fog tools.

## Foundry VTT

1. **Scenes → Create Scene**, open its configuration.
2. **Background image:** upload or choose the exported PNG. Foundry sets the scene width and height
   from the image **(verify in current version: in some versions you press a "reset dimensions"
   button)**.
3. **Grid:** type **Square**, **Grid Size = the export's px per cell** (e.g. 70), **Grid Scale /
   Distance = 5**, units **ft**.
4. **Padding** adds empty space around the map but does not misalign the grid. Leave it or set it to 0.
5. If the lines are off by a few pixels, check that the grid offset (X/Y) is 0 **(verify in current
   version)**.

**Walls (experimental).** Export → _Foundry scene (experimental)_ → **PNG + scene JSON** downloads the
image plus `…_foundry-scene.json`:

- Wall segments are in pixel coordinates at the same cell size.
- Doors are Foundry doors and secret doors are Foundry secret doors, all closed.
- Every wall blocks movement, sight, light and sound ("normal").

To import: upload the PNG, then right-click the scene in the Scenes sidebar → **Import Data** and pick
the JSON **(verify in current version)**. The JSON targets the scene/wall fields of Foundry v11–v12
(`c`, `door`, `ds`, `move`, `sight`, `light`, `sound`, `grid.size`, `grid.distance`). Newer
versions may rename fields, so check the walls after importing.

## Roll20

Roll20 measures pages in "units", and **1 unit = 70 px = 5 ft by default (verify in current
version)**.

1. **Page Settings:** set the page **width and height in units to the map's cells** (e.g. 30 × 20).
   Keep the grid cell width at 1 unit.
2. Drag the PNG onto the page on the **Map & Background** layer.
3. Right-click the image → **Advanced → Set Dimensions**. Set it to the map size in units (30 × 20)
   or in pixels (2100 × 1400 for a 70 px export) **(verify in current version)**. A 2× export can
   also be set to 30 × 20 units: it is scaled down by exactly 2, so the grid still lines up.
4. Move the image so its top-left corner sits on the page's top-left corner. Snapping to the grid
   helps; hold **Alt** while dragging to move without snapping.
5. **Diagonals:** Roll20's page setting for diagonal measurement offers a 5e-style option and an
   alternating option **(verify in current version)**. Match it to the Measure tool's "Diagonals"
   setting in DM Toolkit.

## Owlbear Rodeo

1. Add the exported PNG as a **map**.
2. In the map's grid settings, set the **grid size to the export's px per cell** (Owlbear calls this
   the map's grid "DPI" or cell size in pixels) **(verify in current version)**.
3. Set the scene's grid **scale to 5 ft**.
4. Make sure the grid offset is zero so cell A1 starts at the image's top-left corner.

## Printing

Export → **Print (PDF)** scales the map to fit one Letter, A4 or custom page. The PDF has the map
name and a scale bar in feet, with alternating segments of one square each, so you can check the
printed scale with a ruler. The footer gives the actual size of a square on paper (mm per square).
One-inch battle-mat printing across several pages is not implemented yet.
