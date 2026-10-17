// EXPERIMENTAL (stretch goal): Foundry VTT scene JSON with walls and doors, to be
// imported alongside the exported PNG. Field names follow Foundry's scene/wall
// documents as of v11–v12; verify in your Foundry version before relying on it
// (see docs/vtt-export.md).

import type { MapDoc, WallEdge } from '../layers/model'
import { parseEdgeKey } from '../layers/model'
import { slugName } from './layout'

/** Foundry wall restriction level: 20 = normal (blocks). */
const NORMAL = 20

export interface FoundryWall {
  c: [number, number, number, number]
  /** 0 = none, 1 = door, 2 = secret door. */
  door: 0 | 1 | 2
  /** Door state: 0 = closed. */
  ds: 0
  move: number
  sight: number
  light: number
  sound: number
}

export interface FoundryScene {
  name: string
  width: number
  height: number
  padding: number
  background: { src: string }
  grid: { type: 1; size: number; distance: number; units: 'ft' }
  walls: FoundryWall[]
  flags: Record<string, unknown>
}

const doorType = (w: WallEdge): 0 | 1 | 2 => (w.secret ? 2 : w.door ? 1 : 0)

/**
 * Merges runs of collinear unit edges of the same type into single walls, so
 * Foundry gets a handful of long segments instead of one per square. Doors stay
 * one wall per door run.
 */
export function mergeWallSegments(walls: Record<string, WallEdge>) {
  type Run = { o: 'h' | 'v'; fixed: number; start: number; end: number; type: 0 | 1 | 2 }
  const byLine = new Map<string, { at: number; type: 0 | 1 | 2 }[]>()
  for (const [k, w] of Object.entries(walls)) {
    const e = parseEdgeKey(k)
    const line = e.o === 'h' ? `h${e.y}` : `v${e.x}`
    const list = byLine.get(line) ?? []
    list.push({ at: e.o === 'h' ? e.x : e.y, type: doorType(w) })
    byLine.set(line, list)
  }
  const runs: Run[] = []
  for (const [line, list] of byLine) {
    list.sort((a, b) => a.at - b.at)
    const o = line[0] as 'h' | 'v'
    const fixed = Number(line.slice(1))
    let cur: Run | null = null
    for (const s of list) {
      if (cur && cur.end === s.at && cur.type === s.type) cur.end = s.at + 1
      else {
        if (cur) runs.push(cur)
        cur = { o, fixed, start: s.at, end: s.at + 1, type: s.type }
      }
    }
    if (cur) runs.push(cur)
  }
  return runs
}

export function toFoundryScene(doc: MapDoc, cellPx: number, imageFile: string): FoundryScene {
  const walls = mergeWallSegments(doc.walls).map((r): FoundryWall => {
    const c: [number, number, number, number] =
      r.o === 'h'
        ? [r.start * cellPx, r.fixed * cellPx, r.end * cellPx, r.fixed * cellPx]
        : [r.fixed * cellPx, r.start * cellPx, r.fixed * cellPx, r.end * cellPx]
    return { c, door: r.type, ds: 0, move: NORMAL, sight: NORMAL, light: NORMAL, sound: NORMAL }
  })
  return {
    name: doc.name,
    width: doc.width * cellPx,
    height: doc.height * cellPx,
    padding: 0,
    background: { src: imageFile },
    grid: { type: 1, size: cellPx, distance: doc.grid.feetPerCell, units: 'ft' },
    walls,
    flags: { 'dm-toolkit': { exportedAt: new Date().toISOString(), experimental: true } },
  }
}

export const foundryFilename = (doc: MapDoc) => `${slugName(doc.name)}_foundry-scene.json`
