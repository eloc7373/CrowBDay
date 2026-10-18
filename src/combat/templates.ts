// Area-of-effect templates on a square grid. Cells are chosen by their centres,
// which is how most tables do it. This is a DM aid: shapes follow the SRD 5.1
// definitions (a cone is as wide as it is long, a line is 5 ft wide unless
// stated), but edge cases are the DM's call.

import { cellKey, type Cell } from '../lib/geometry'
import type { MapDoc } from '../mapcreator/layers/model'
import { propRect } from '../mapcreator/tools/paint'

export type TemplateShape = 'sphere' | 'cylinder' | 'cube' | 'cone' | 'line'

export const TEMPLATE_SHAPES: { id: TemplateShape; label: string; sizeLabel: string }[] = [
  { id: 'sphere', label: 'Sphere', sizeLabel: 'Radius (ft)' },
  { id: 'cylinder', label: 'Cylinder', sizeLabel: 'Radius (ft)' },
  { id: 'cube', label: 'Cube', sizeLabel: 'Side (ft)' },
  { id: 'cone', label: 'Cone', sizeLabel: 'Length (ft)' },
  { id: 'line', label: 'Line', sizeLabel: 'Length (ft)' },
]

export interface Template {
  shape: TemplateShape
  /** Radius, side or length in feet, depending on the shape. */
  sizeFt: number
  /** Width of a line in feet. */
  widthFt?: number
  origin: Cell
  /** Aim point for cones and lines (ignored by the other shapes). */
  target: Cell
}

const EPS = 1e-9

/** Cells covered by the template, ignoring the map bounds. The origin cell is included except for cones and lines. */
export function templateCells(t: Template, feetPerCell: number): Cell[] {
  const out: Cell[] = []
  const size = t.sizeFt / feetPerCell
  const ox = t.origin.x
  const oy = t.origin.y
  switch (t.shape) {
    case 'sphere':
    case 'cylinder': {
      const r = Math.ceil(size)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (dx * dx + dy * dy <= size * size + EPS) out.push({ x: ox + dx, y: oy + dy })
      break
    }
    case 'cube': {
      const n = Math.max(1, Math.round(size))
      // Centred on the origin; for even sizes the origin is the lower-right of the middle four.
      const x0 = ox - Math.ceil(n / 2) + 1
      const y0 = oy - Math.ceil(n / 2) + 1
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out.push({ x: x0 + x, y: y0 + y })
      break
    }
    case 'cone':
    case 'line': {
      let ax = t.target.x - ox
      let ay = t.target.y - oy
      if (ax === 0 && ay === 0) ax = 1
      const len = Math.hypot(ax, ay)
      ax /= len
      ay /= len
      const reach = Math.ceil(size) + 1
      const halfWidth = (t.widthFt ?? 5) / feetPerCell / 2
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          if (dx === 0 && dy === 0) continue
          const along = dx * ax + dy * ay
          if (along <= EPS || along > size + EPS) continue
          const across = Math.abs(-dx * ay + dy * ax)
          // A cone is as wide as it is long: its half-width at distance d is d / 2.
          const limit = t.shape === 'cone' ? along / 2 + EPS : halfWidth + EPS
          if (across <= limit) out.push({ x: ox + dx, y: oy + dy })
        }
      }
      break
    }
  }
  return out
}

/** Template cells that lie on the map. */
export function templateCellsOnMap(t: Template, doc: MapDoc): Cell[] {
  return templateCells(t, doc.grid.feetPerCell).filter(
    (c) => c.x >= 0 && c.y >= 0 && c.x < doc.width && c.y < doc.height,
  )
}

/** Tokens (Tokens layer) with at least one square inside the given cells. */
export function tokensInCells(doc: MapDoc, cells: Cell[]): string[] {
  const set = new Set(cells.map((c) => cellKey(c.x, c.y)))
  return Object.values(doc.props)
    .filter((p) => {
      if (p.layer !== 'tokens') return false
      const r = propRect(p)
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) if (set.has(cellKey(x, y))) return true
      return false
    })
    .map((p) => p.id)
}
