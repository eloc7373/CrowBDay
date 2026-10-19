// Movement cost for a creature walking between two cells, in feet.
//
// Costs follow the 2014 Player's Handbook: every square costs one grid step (5 ft by default),
// and each square of difficult terrain costs one extra step. Diagonals follow
// the chosen rule. Walls (and secret doors) block, open doors do not, and so do
// terrain or objects flagged "blocks movement". Only the creature's anchor
// (top-left) square is routed, so large creatures can squeeze through gaps.

import { cellKey, type Cell } from '../lib/geometry'
import { edgeKey, type MapDoc } from '../mapcreator/layers/model'
import type { DiagonalRule } from '../mapcreator/tools/measure'

export interface MovePath {
  feet: number
  cells: Cell[]
}

function blockedCells(doc: MapDoc): Set<string> {
  const out = new Set<string>()
  for (const [k, id] of Object.entries(doc.tiles)) if (doc.assets?.[id]?.blocksMovement) out.add(k)
  for (const p of Object.values(doc.props)) {
    if (p.layer !== 'objects' || !doc.assets?.[p.defId]?.blocksMovement) continue
    const fp = doc.assets[p.defId].footprint
    const swap = p.rotation === 90 || p.rotation === 270
    const w = swap ? fp.h : fp.w
    const h = swap ? fp.w : fp.h
    for (let y = p.y; y < p.y + h; y++) for (let x = p.x; x < p.x + w; x++) out.add(cellKey(x, y))
  }
  return out
}

/** Whether a wall edge stops a creature (doors that are not secret can be opened). */
function wallStops(doc: MapDoc, key: string): boolean {
  const w = doc.walls[key]
  return !!w && (!w.door || w.secret)
}

/** Edge crossed when stepping orthogonally from (x, y) by (dx, dy). */
function crossing(x: number, y: number, dx: number, dy: number): string {
  if (dx === 1) return edgeKey('v', x + 1, y)
  if (dx === -1) return edgeKey('v', x, y)
  if (dy === 1) return edgeKey('h', x, y + 1)
  return edgeKey('h', x, y)
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

interface Node {
  x: number
  y: number
  /** Parity of diagonals taken so far (for the alternating rule). */
  par: number
  cost: number
  prev: Node | null
}

/**
 * Cheapest route from `from` to `to`, or null if walls and obstacles leave no route.
 * Searches only the area around the two cells, so it stays fast on big maps.
 */
export function movePath(
  doc: MapDoc,
  from: Cell,
  to: Cell,
  rule: DiagonalRule,
  margin = 12,
): MovePath | null {
  const blocked = blockedCells(doc)
  if (blocked.has(cellKey(to.x, to.y))) return null
  const minX = Math.max(0, Math.min(from.x, to.x) - margin)
  const maxX = Math.min(doc.width - 1, Math.max(from.x, to.x) + margin)
  const minY = Math.max(0, Math.min(from.y, to.y) - margin)
  const maxY = Math.min(doc.height - 1, Math.max(from.y, to.y) + margin)

  const key = (x: number, y: number, par: number) => `${x},${y},${par}`
  const best = new Map<string, number>([[key(from.x, from.y, 0), 0]])
  const open: Node[] = [{ x: from.x, y: from.y, par: 0, cost: 0, prev: null }]
  const difficult = (x: number, y: number) =>
    doc.assets?.[doc.tiles[cellKey(x, y)]]?.difficultTerrain

  while (open.length) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (open[i].cost < open[bi].cost) bi = i
    const n = open.splice(bi, 1)[0]
    if (n.cost > (best.get(key(n.x, n.y, n.par)) ?? Infinity)) continue
    if (n.x === to.x && n.y === to.y) {
      const cells: Cell[] = []
      for (let c: Node | null = n; c; c = c.prev) cells.unshift({ x: c.x, y: c.y })
      return { feet: Math.round(n.cost * doc.grid.feetPerCell * 10) / 10, cells }
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const x = n.x + dx
      const y = n.y + dy
      if (x < minX || x > maxX || y < minY || y > maxY) continue
      if (blocked.has(cellKey(x, y))) continue
      const diag = dx !== 0 && dy !== 0
      if (diag) {
        // Do not cut a wall corner.
        if (
          wallStops(doc, crossing(n.x, n.y, dx, 0)) ||
          wallStops(doc, crossing(n.x, n.y, 0, dy)) ||
          wallStops(doc, crossing(x, n.y, 0, dy)) ||
          wallStops(doc, crossing(n.x, y, dx, 0))
        )
          continue
      } else if (wallStops(doc, crossing(n.x, n.y, dx, dy))) continue
      let step = 1
      let par = n.par
      if (diag) {
        if (rule === 'alternating') {
          step = n.par === 0 ? 1 : 2
          par = 1 - n.par
        } else if (rule === 'euclidean') step = Math.SQRT2
      }
      if (difficult(x, y)) step += 1
      const cost = n.cost + step
      const k = key(x, y, par)
      if (cost < (best.get(k) ?? Infinity) - 1e-9) {
        best.set(k, cost)
        open.push({ x, y, par, cost, prev: n })
      }
    }
  }
  return null
}
