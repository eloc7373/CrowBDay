// Export geometry. Pure functions so the maths can be unit tested.
//
// GRID ALIGNMENT (PNG export)
// ---------------------------
// VTTs place a background image with its top-left pixel at the scene origin and
// then lay a square grid of `G` pixels over it. For the map grid to line up, every
// cell in the image must be exactly G whole pixels and cell (0, 0) must start at
// pixel (0, 0). So:
//
//   exportCellPx = round(cellPx × scale)            (an integer number of pixels)
//   imageWidth   = mapWidthCells  × exportCellPx    (no padding, no border)
//   imageHeight  = mapHeightCells × exportCellPx
//   cell (cx, cy) covers pixels [cx·G, (cx+1)·G) × [cy·G, (cy+1)·G)
//
// Example: 30×20 cells at 70 px, 1× → 2100×1400 px; at 2× → 140 px cells, 4200×2800.
//
// Grid lines are drawn as filled pixel rectangles (not anti-aliased strokes) so
// they land exactly on the cell boundaries: the line for boundary i starts at
// pixel column i·G and is `lineWidth` pixels wide, extending *into* the cell to
// its right/bottom. The final boundary (i = width) would fall outside the
// image, so it is drawn on the last `lineWidth` pixels instead.

export interface PngLayoutOptions {
  /** Base pixels per cell (defaults to the map's cell size). */
  cellPx: number
  /** 1 or 2 (any positive multiplier works). */
  scale: number
}

export interface PngLayout {
  cellPx: number
  width: number
  height: number
  filename: string
}

/** Browsers refuse canvases above roughly these limits (Chrome: 16384 px per side). */
export const MAX_CANVAS_SIDE = 16384
export const MAX_CANVAS_AREA = 268_435_456

export function slugName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'map'
  )
}

export function pngLayout(
  name: string,
  cellsW: number,
  cellsH: number,
  o: PngLayoutOptions,
): PngLayout {
  const cellPx = Math.max(1, Math.round(o.cellPx * o.scale))
  return {
    cellPx,
    width: cellsW * cellPx,
    height: cellsH * cellPx,
    filename: `${slugName(name)}_${cellsW}x${cellsH}_${cellPx}px.png`,
  }
}

export function fitsCanvas(width: number, height: number): boolean {
  return width <= MAX_CANVAS_SIDE && height <= MAX_CANVAS_SIDE && width * height <= MAX_CANVAS_AREA
}

/**
 * Pixel offsets (left/top edge) of every grid line along one axis.
 * Line i (0 ≤ i < cells) starts at i·cellPx; the closing line sits flush with the
 * far edge at cells·cellPx − lineWidth.
 */
export function gridLineOffsets(cells: number, cellPx: number, lineWidth: number): number[] {
  const out: number[] = []
  for (let i = 0; i < cells; i++) out.push(i * cellPx)
  out.push(cells * cellPx - lineWidth)
  return out
}

/** Grid line thickness for an export: 1 px per 70 px of cell, at least 1. */
export const gridLineWidth = (cellPx: number) => Math.max(1, Math.round(cellPx / 70))

// ---- PDF ---------------------------------------------------------------------

export interface Paper {
  /** Width/height in millimetres (portrait). */
  w: number
  h: number
}

export const PAPERS: Record<'letter' | 'a4', Paper & { label: string }> = {
  letter: { w: 215.9, h: 279.4, label: 'US Letter (8.5 × 11 in)' },
  a4: { w: 210, h: 297, label: 'A4 (210 × 297 mm)' },
}

export interface PdfFit {
  orientation: 'portrait' | 'landscape'
  pageW: number
  pageH: number
  /** Millimetres per cell on paper. */
  mmPerCell: number
  x: number
  y: number
  w: number
  h: number
}

/**
 * Scales a map to fit inside the page margins (keeping aspect ratio) and picks
 * the orientation that gives the larger map. `reserveBottom` leaves room for the
 * title and scale bar.
 */
export function fitToPage(
  cellsW: number,
  cellsH: number,
  paper: Paper,
  margin: number,
  reserveBottom: number,
): PdfFit {
  const options = (['portrait', 'landscape'] as const).map((orientation) => {
    const pageW = orientation === 'portrait' ? paper.w : paper.h
    const pageH = orientation === 'portrait' ? paper.h : paper.w
    const availW = pageW - margin * 2
    const availH = pageH - margin * 2 - reserveBottom
    const mmPerCell = Math.min(availW / cellsW, availH / cellsH)
    const w = cellsW * mmPerCell
    const h = cellsH * mmPerCell
    return { orientation, pageW, pageH, mmPerCell, x: (pageW - w) / 2, y: margin, w, h }
  })
  return options[0].mmPerCell >= options[1].mmPerCell ? options[0] : options[1]
}

/**
 * Length in feet for the scale bar: the largest "round" value ≤ maxFeet that is
 * a whole number of cells (so the bar's ticks line up with squares). Never less
 * than one cell.
 */
export function niceScaleFeet(maxFeet: number, feetPerCell: number): number {
  const steps = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 60, 100, 150, 200, 250, 500, 1000, 2000, 5000]
  const wholeCells = (s: number) => Math.abs(s / feetPerCell - Math.round(s / feetPerCell)) < 1e-9
  let best = feetPerCell
  for (const s of steps) if (s >= feetPerCell && s <= maxFeet && wholeCells(s)) best = s
  return best
}
