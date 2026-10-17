// Grid geometry helpers. All coordinates are integer cell indices unless noted.
// Cell (x, y) covers world pixels [x*cell, (x+1)*cell) × [y*cell, (y+1)*cell).

export interface Cell {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const cellKey = (x: number, y: number): string => `${x},${y}`

export function parseCellKey(key: string): Cell {
  const i = key.indexOf(',')
  return { x: Number(key.slice(0, i)), y: Number(key.slice(i + 1)) }
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

export const inBounds = (x: number, y: number, width: number, height: number): boolean =>
  x >= 0 && y >= 0 && x < width && y < height

/** Spreadsheet-style column letters: 0 → A, 25 → Z, 26 → AA. */
export function columnLabel(col: number): string {
  let n = col + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Human-readable cell name, e.g. (2, 6) → "C7" (rows are 1-based). */
export const cellLabel = (x: number, y: number): string => `${columnLabel(x)}${y + 1}`

/** Inclusive rectangle spanning two cells, in either order. */
export function rectFromCells(a: Cell, b: Cell): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Bresenham line between two cells, inclusive of both ends. */
export function lineCells(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = []
  let x = a.x
  let y = a.y
  const dx = Math.abs(b.x - a.x)
  const dy = -Math.abs(b.y - a.y)
  const sx = a.x < b.x ? 1 : -1
  const sy = a.y < b.y ? 1 : -1
  let err = dx + dy
  for (;;) {
    out.push({ x, y })
    if (x === b.x && y === b.y) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
  return out
}

/**
 * Square brush footprint of `size` cells centred on (cx, cy). For even sizes the
 * cursor cell is the upper-left of the centre four.
 */
export function brushCells(cx: number, cy: number, size: number): Cell[] {
  const start = Math.floor((size - 1) / 2)
  const out: Cell[] = []
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) out.push({ x: cx - start + dx, y: cy - start + dy })
  }
  return out
}

/** Stamps a brush along every cell of a line, de-duplicated. */
export function brushLineCells(a: Cell, b: Cell, size: number): Cell[] {
  const seen = new Set<string>()
  const out: Cell[] = []
  for (const p of lineCells(a, b)) {
    for (const c of brushCells(p.x, p.y, size)) {
      const k = cellKey(c.x, c.y)
      if (!seen.has(k)) {
        seen.add(k)
        out.push(c)
      }
    }
  }
  return out
}

export type ShapeMode = 'fill' | 'outline'

export function rectCells(a: Cell, b: Cell, mode: ShapeMode): Cell[] {
  const r = rectFromCells(a, b)
  const out: Cell[] = []
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1
      if (mode === 'fill' || edge) out.push({ x, y })
    }
  }
  return out
}

/**
 * Cells whose centres fall inside the ellipse inscribed in the rectangle spanned
 * by a and b. Outline mode keeps inside cells that have a 4-neighbour outside.
 */
export function ellipseCells(a: Cell, b: Cell, mode: ShapeMode): Cell[] {
  const r = rectFromCells(a, b)
  const rx = r.w / 2
  const ry = r.h / 2
  const cx = r.x + rx
  const cy = r.y + ry
  const inside = (x: number, y: number) => {
    const nx = (x + 0.5 - cx) / rx
    const ny = (y + 0.5 - cy) / ry
    return nx * nx + ny * ny <= 1
  }
  const out: Cell[] = []
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (!inside(x, y)) continue
      if (
        mode === 'fill' ||
        !inside(x - 1, y) ||
        !inside(x + 1, y) ||
        !inside(x, y - 1) ||
        !inside(x, y + 1)
      ) {
        out.push({ x, y })
      }
    }
  }
  return out
}
