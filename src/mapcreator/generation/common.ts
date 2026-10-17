// Shared types and helpers for the procedural generators. Generators are pure:
// (params, seed) → GenResult, so the same seed always produces the same map.

import { cellKey, type Cell, type Rect } from '../../lib/geometry'
import { createRng, type Rng } from '../../lib/rng'
import { edgeKey, type MapNote, type PlacedProp, type WallEdge } from '../layers/model'

export type GeneratorKind = 'cave' | 'dungeon' | 'tavern' | 'village'

export interface GenRoom extends Rect {
  /** Stable id, e.g. "room-3". */
  id: string
  number: number
  name: string
}

export interface GenResult {
  kind: GeneratorKind
  seed: string
  width: number
  height: number
  tiles: Record<string, string>
  walls: Record<string, WallEdge>
  /** Props without ids; ids are assigned when merged into a map. */
  props: Omit<PlacedProp, 'id'>[]
  notes: Omit<MapNote, 'id'>[]
  rooms: GenRoom[]
  /** Where the party enters (dungeon/cave), if meaningful. */
  entrance: Cell | null
}

export const WALL: WallEdge = { door: false, secret: false }
export const DOOR: WallEdge = { door: true, secret: false }
export const SECRET_DOOR: WallEdge = { door: true, secret: true }

/** Seeded RNG namespaced by generator so different generators diverge for one seed. */
export const rngFor = (kind: GeneratorKind, seed: string): Rng => createRng(`${kind}:${seed}`)

export const clampInt = (v: number, lo: number, hi: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback

/** Boolean grid helper backed by a typed array. */
export class Grid {
  readonly data: Uint8Array
  readonly w: number
  readonly h: number
  constructor(w: number, h: number, fill = 0) {
    this.w = w
    this.h = h
    this.data = new Uint8Array(w * h).fill(fill)
  }
  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }
  get(x: number, y: number, outside = 0) {
    return this.inside(x, y) ? this.data[y * this.w + x] : outside
  }
  set(x: number, y: number, v: number) {
    if (this.inside(x, y)) this.data[y * this.w + x] = v
  }
}

/** 4-connected regions of cells where `open(x, y)` is true, in scan order. */
export function regions(w: number, h: number, open: (x: number, y: number) => boolean): Cell[][] {
  const seen = new Uint8Array(w * h)
  const out: Cell[][] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] || !open(x, y)) continue
      const region: Cell[] = []
      const stack: Cell[] = [{ x, y }]
      seen[y * w + x] = 1
      while (stack.length) {
        const c = stack.pop()!
        region.push(c)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = c.x + dx
          const ny = c.y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          if (seen[ny * w + nx] || !open(nx, ny)) continue
          seen[ny * w + nx] = 1
          stack.push({ x: nx, y: ny })
        }
      }
      out.push(region)
    }
  }
  return out
}

/**
 * Wall edges around every floor cell that borders non-floor (or the map edge).
 * Edges between two floor cells stay open.
 */
export function wallsAroundFloor(
  w: number,
  h: number,
  isFloor: (x: number, y: number) => boolean,
): Record<string, WallEdge> {
  const walls: Record<string, WallEdge> = {}
  const floor = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && isFloor(x, y)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!floor(x, y)) continue
      if (!floor(x, y - 1)) walls[edgeKey('h', x, y)] = WALL
      if (!floor(x, y + 1)) walls[edgeKey('h', x, y + 1)] = WALL
      if (!floor(x - 1, y)) walls[edgeKey('v', x, y)] = WALL
      if (!floor(x + 1, y)) walls[edgeKey('v', x + 1, y)] = WALL
    }
  }
  return walls
}

/** Edge key between two 4-adjacent cells. */
export function edgeBetween(a: Cell, b: Cell): string {
  if (a.x === b.x) return edgeKey('h', a.x, Math.max(a.y, b.y))
  return edgeKey('v', Math.max(a.x, b.x), a.y)
}

/** Fills a rectangle of tiles. */
export function fillRect(tiles: Record<string, string>, r: Rect, tile: string) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) tiles[cellKey(x, y)] = tile
}

/** Walls around a rectangle's outline (outer edges of the rect's cells). */
export function rectOutlineWalls(walls: Record<string, WallEdge>, r: Rect) {
  for (let x = r.x; x < r.x + r.w; x++) {
    walls[edgeKey('h', x, r.y)] = WALL
    walls[edgeKey('h', x, r.y + r.h)] = WALL
  }
  for (let y = r.y; y < r.y + r.h; y++) {
    walls[edgeKey('v', r.x, y)] = WALL
    walls[edgeKey('v', r.x + r.w, y)] = WALL
  }
}

export const center = (r: Rect): Cell => ({
  x: r.x + Math.floor(r.w / 2),
  y: r.y + Math.floor(r.h / 2),
})

/** Occupancy grid for placing furniture without overlaps. */
export class Occupancy {
  private used = new Set<string>()
  free(x: number, y: number, w: number, h: number, area: Rect): boolean {
    if (x < area.x || y < area.y || x + w > area.x + area.w || y + h > area.y + area.h) return false
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) if (this.used.has(cellKey(xx, yy))) return false
    return true
  }
  take(x: number, y: number, w: number, h: number) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.used.add(cellKey(xx, yy))
  }
}

export function emptyResult(
  kind: GeneratorKind,
  seed: string,
  width: number,
  height: number,
): GenResult {
  return {
    kind,
    seed,
    width,
    height,
    tiles: {},
    walls: {},
    props: [],
    notes: [],
    rooms: [],
    entrance: null,
  }
}

export const prop = (
  defId: string,
  x: number,
  y: number,
  rotation: PlacedProp['rotation'] = 0,
): Omit<PlacedProp, 'id'> => ({ layer: 'objects', defId, x, y, rotation, mirrored: false })
