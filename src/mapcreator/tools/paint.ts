// Pure edit builders for the painting tools. They return Changes against `doc`;
// the store applies them so everything stays undoable.

import { cellKey, inBounds, parseCellKey, type Cell } from '../../lib/geometry'
import {
  cellEdgeKeys,
  edgeKey,
  rotatedFootprint,
  SIZE_SQUARES,
  type CreatureSize,
  type Footprint,
  type LayerId,
  type MapDoc,
  type PlacedProp,
  type PropRotation,
} from '../layers/model'
import { compact, setChange, type Change } from '../store/history'
import { getAsset } from '../tilesets/registry'

const inMap = (doc: MapDoc) => (c: Cell) => inBounds(c.x, c.y, doc.width, doc.height)

/** Sets terrain tiles on every in-bounds cell. */
export function paintChanges(doc: MapDoc, cells: Cell[], tileId: string): Change[] {
  return compact(
    cells.filter(inMap(doc)).map((c) => setChange(doc, 'tiles', cellKey(c.x, c.y), tileId)),
  )
}

/** Cells covered by a prop: tokens use creature size, other props their rotated footprint. */
export function propFootprint(
  defId: string,
  rotation: PropRotation,
  token?: { size: CreatureSize } | null,
): Footprint {
  if (token) {
    const n = SIZE_SQUARES[token.size]
    return { w: n, h: n }
  }
  return rotatedFootprint(getAsset(defId)?.footprint ?? { w: 1, h: 1 }, rotation)
}

export function propRect(p: Pick<PlacedProp, 'defId' | 'x' | 'y' | 'rotation' | 'token'>) {
  const fp = propFootprint(p.defId, p.rotation, p.token)
  return { x: p.x, y: p.y, w: fp.w, h: fp.h }
}

const propCovers = (p: PlacedProp, x: number, y: number) => {
  const r = propRect(p)
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h
}

/** Removes content of the given layer under the given cells. */
export function eraseChanges(doc: MapDoc, layer: LayerId, cells: Cell[]): Change[] {
  const inside = cells.filter(inMap(doc))
  switch (layer) {
    case 'terrain':
      return compact(inside.map((c) => setChange(doc, 'tiles', cellKey(c.x, c.y), undefined)))
    case 'walls': {
      const keys = new Set(inside.flatMap((c) => cellEdgeKeys(c.x, c.y)))
      return compact([...keys].map((k) => setChange(doc, 'walls', k, undefined)))
    }
    case 'objects':
    case 'tokens': {
      const hit = Object.values(doc.props).filter(
        (p) => p.layer === layer && inside.some((c) => propCovers(p, c.x, c.y)),
      )
      return compact(hit.map((p) => setChange(doc, 'props', p.id, undefined)))
    }
    case 'notes': {
      const keys = new Set(inside.map((c) => cellKey(c.x, c.y)))
      const hit = Object.values(doc.notes).filter((n) => keys.has(cellKey(n.x, n.y)))
      return compact(hit.map((n) => setChange(doc, 'notes', n.id, undefined)))
    }
  }
}

/**
 * Cells reachable from `start` (4-connected) that hold the same terrain tile as
 * `start` (including "empty"). Bounded by the map edges and, optionally, walls.
 */
export function floodRegion(doc: MapDoc, start: Cell, respectWalls = false): Cell[] {
  if (!inBounds(start.x, start.y, doc.width, doc.height)) return []
  const target = doc.tiles[cellKey(start.x, start.y)]
  const seen = new Set<string>([cellKey(start.x, start.y)])
  const out: Cell[] = []
  const stack: Cell[] = [start]
  while (stack.length) {
    const c = stack.pop()!
    out.push(c)
    // [dx, dy, wall edge crossed when stepping that way]
    const steps: [number, number, string][] = [
      [1, 0, edgeKey('v', c.x + 1, c.y)],
      [-1, 0, edgeKey('v', c.x, c.y)],
      [0, 1, edgeKey('h', c.x, c.y + 1)],
      [0, -1, edgeKey('h', c.x, c.y)],
    ]
    for (const [dx, dy, wall] of steps) {
      const nx = c.x + dx
      const ny = c.y + dy
      const k = cellKey(nx, ny)
      if (seen.has(k) || !inBounds(nx, ny, doc.width, doc.height)) continue
      if (doc.tiles[k] !== target) continue
      if (respectWalls && doc.walls[wall]) continue
      seen.add(k)
      stack.push({ x: nx, y: ny })
    }
  }
  return out
}

export function fillChanges(doc: MapDoc, start: Cell, tileId: string, respectWalls = false) {
  if (doc.tiles[cellKey(start.x, start.y)] === tileId) return []
  return paintChanges(doc, floodRegion(doc, start, respectWalls), tileId)
}

/** Terrain tile or prop/note def under a cell for the eyedropper. */
export function sampleAt(doc: MapDoc, layer: LayerId, c: Cell): string | undefined {
  if (layer === 'objects' || layer === 'tokens') {
    const props = Object.values(doc.props).filter(
      (p) => p.layer === layer && propCovers(p, c.x, c.y),
    )
    return props[props.length - 1]?.defId
  }
  return doc.tiles[cellKey(c.x, c.y)]
}

export function propsAt(doc: MapDoc, layer: 'objects' | 'tokens', x: number, y: number) {
  return Object.values(doc.props).filter((p) => p.layer === layer && propCovers(p, x, y))
}

export const cellsFromKeys = (keys: string[]) => keys.map(parseCellKey)
