// Cave generator: cellular automata.
// 1. Randomly fill cells with rock (fillPercent), map border always rock.
// 2. Smooth: a cell becomes rock with >4 rock neighbours (of 8), floor with <4.
// 3. Drop open regions smaller than minCaveSize.
// 4. Optionally carve tunnels so every remaining cave is connected.
// Output: dirt floor + rock terrain, and walls on every floor/rock boundary.

import { cellKey, lineCells, type Cell } from '../../lib/geometry'
import { MAX_MAP_SIZE } from '../layers/model'
import {
  clampInt,
  emptyResult,
  Grid,
  regions,
  rngFor,
  wallsAroundFloor,
  type GenResult,
} from './common'

export interface CaveParams {
  width: number
  height: number
  /** Initial rock percentage, 30–70. */
  fillPercent: number
  /** Smoothing passes, 0–10. */
  iterations: number
  /** Open regions with fewer cells are filled in. */
  minCaveSize: number
  connect: boolean
}

export const CAVE_DEFAULTS: CaveParams = {
  width: 40,
  height: 30,
  fillPercent: 45,
  iterations: 4,
  minCaveSize: 12,
  connect: true,
}

const ROCK = 1
const OPEN = 0

export function generateCave(params: Partial<CaveParams>, seed: string): GenResult {
  const p = { ...CAVE_DEFAULTS, ...params }
  const w = clampInt(p.width, 8, MAX_MAP_SIZE, CAVE_DEFAULTS.width)
  const h = clampInt(p.height, 8, MAX_MAP_SIZE, CAVE_DEFAULTS.height)
  const fill = clampInt(p.fillPercent, 30, 70, 45) / 100
  const iterations = clampInt(p.iterations, 0, 10, 4)
  const minSize = clampInt(p.minCaveSize, 1, w * h, 12)
  const rng = rngFor('cave', seed)

  let grid = new Grid(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const border = x === 0 || y === 0 || x === w - 1 || y === h - 1
      grid.set(x, y, border || rng.chance(fill) ? ROCK : OPEN)
    }
  }

  for (let i = 0; i < iterations; i++) {
    const next = new Grid(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && grid.get(x + dx, y + dy, ROCK)) n++
        const border = x === 0 || y === 0 || x === w - 1 || y === h - 1
        next.set(x, y, border || n > 4 ? ROCK : n < 4 ? OPEN : grid.get(x, y))
      }
    }
    grid = next
  }

  let caves = regions(w, h, (x, y) => grid.get(x, y) === OPEN)
  for (const r of caves) if (r.length < minSize) for (const c of r) grid.set(c.x, c.y, ROCK)
  caves = caves.filter((r) => r.length >= minSize)

  // Guarantee at least one cave so the result is never solid rock.
  if (!caves.length) {
    const cx = Math.floor(w / 2)
    const cy = Math.floor(h / 2)
    const r = Math.max(1, Math.min(3, Math.floor(Math.min(w, h) / 4)))
    const area: Cell[] = []
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        grid.set(x, y, OPEN)
        area.push({ x, y })
      }
    caves = [area]
  }

  if (p.connect && caves.length > 1) connectCaves(grid, caves)

  const res = emptyResult('cave', seed, w, h)
  const isOpen = (x: number, y: number) => grid.get(x, y) === OPEN
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // A sprinkle of rubble breaks up large open floors.
      res.tiles[cellKey(x, y)] = isOpen(x, y) ? (rng.chance(0.04) ? 'rubble' : 'dirt') : 'rock'
    }
  }
  res.walls = wallsAroundFloor(w, h, isOpen)

  // Entrance: the open cell closest to the middle of the left edge.
  let best: Cell | null = null
  let bestD = Infinity
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!isOpen(x, y)) continue
      const d = x * 2 + Math.abs(y - h / 2)
      if (d < bestD) {
        bestD = d
        best = { x, y }
      }
    }
  res.entrance = best
  return res
}

/** Bresenham line made 4-connected by inserting a corner cell at each diagonal step. */
export function line4(a: Cell, b: Cell): Cell[] {
  const line = lineCells(a, b)
  const out: Cell[] = [line[0]]
  for (let i = 1; i < line.length; i++) {
    const prev = line[i - 1]
    const c = line[i]
    if (c.x !== prev.x && c.y !== prev.y) out.push({ x: c.x, y: prev.y })
    out.push(c)
  }
  return out
}

/**
 * Joins caves into one network: repeatedly links the unconnected cave nearest to
 * the connected set with a straight tunnel between their closest cells.
 */
function connectCaves(grid: Grid, caves: Cell[][]) {
  const sorted = [...caves].sort((a, b) => b.length - a.length)
  const connected: Cell[] = [...sorted[0]]
  const rest = sorted.slice(1)
  while (rest.length) {
    let bestI = 0
    let bestA: Cell = connected[0]
    let bestB: Cell = rest[0][0]
    let bestD = Infinity
    // Sample connected cells to keep this fast on big maps; results stay deterministic.
    const step = Math.max(1, Math.floor(connected.length / 400))
    rest.forEach((cave, i) => {
      const cstep = Math.max(1, Math.floor(cave.length / 100))
      for (let a = 0; a < connected.length; a += step) {
        for (let b = 0; b < cave.length; b += cstep) {
          const d = Math.abs(connected[a].x - cave[b].x) + Math.abs(connected[a].y - cave[b].y)
          if (d < bestD) {
            bestD = d
            bestI = i
            bestA = connected[a]
            bestB = cave[b]
          }
        }
      }
    })
    for (const c of line4(bestA, bestB)) grid.set(c.x, c.y, OPEN)
    connected.push(...rest[bestI])
    rest.splice(bestI, 1)
  }
}
