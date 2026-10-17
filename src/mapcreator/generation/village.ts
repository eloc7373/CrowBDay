// Village / town layout generator.
// Blocks are laid out on a grid separated by cobbled main streets; a plaza with
// a well sits at the central crossing. Each block is split by a dirt side path
// into lots; lots get a building (walls, wooden floor, a door toward the path)
// with probability `density`, otherwise grass, trees or a fenced garden.

import { cellKey, type Rect } from '../../lib/geometry'
import { type Rng } from '../../lib/rng'
import { edgeKey, MAX_MAP_SIZE } from '../layers/model'
import {
  clampInt,
  DOOR,
  emptyResult,
  fillRect,
  prop,
  rectOutlineWalls,
  rngFor,
  type GenResult,
} from './common'

export interface VillageParams {
  /** Number of town blocks, 1–16. */
  blocks: number
  /** Main street width in cells, 1–3. */
  roadWidth: number
  /** 0–1: share of lots that get a building. */
  density: number
}

export const VILLAGE_DEFAULTS: VillageParams = { blocks: 4, roadWidth: 2, density: 0.7 }

const BUILDING_NAMES = [
  'Tavern',
  'Smithy',
  'General store',
  'Temple',
  'Stable',
  'Bakery',
  'Tailor',
  'Guard post',
]
const MARGIN = 2

export function generateVillage(params: Partial<VillageParams>, seed: string): GenResult {
  const p = { ...VILLAGE_DEFAULTS, ...params }
  const blocks = clampInt(p.blocks, 1, 16, 4)
  const road = clampInt(p.roadWidth, 1, 3, 2)
  const density = Math.min(1, Math.max(0, Number.isFinite(p.density) ? p.density : 0.7))
  const rng = rngFor('village', seed)

  const cols = Math.ceil(Math.sqrt(blocks))
  const rows = Math.ceil(blocks / cols)
  const colW = Array.from({ length: cols }, () => rng.int(10, 13))
  const rowH = Array.from({ length: rows }, () => rng.int(9, 12))
  // Roads run between blocks and along one outer edge of each axis.
  const W = Math.min(MAX_MAP_SIZE, MARGIN * 2 + colW.reduce((a, b) => a + b, 0) + (cols + 1) * road)
  const H = Math.min(MAX_MAP_SIZE, MARGIN * 2 + rowH.reduce((a, b) => a + b, 0) + (rows + 1) * road)
  const res = emptyResult('village', seed, W, H)
  fillRect(res.tiles, { x: 0, y: 0, w: W, h: H }, 'grass')

  // Main streets.
  const xs: number[] = []
  let x = MARGIN
  for (let c = 0; c <= cols; c++) {
    fillRect(res.tiles, { x, y: MARGIN, w: road, h: H - MARGIN * 2 }, 'cobblestone')
    if (c < cols) xs.push(x + road)
    x += road + (colW[c] ?? 0)
  }
  const ys: number[] = []
  let y = MARGIN
  for (let r = 0; r <= rows; r++) {
    fillRect(res.tiles, { x: MARGIN, y, w: W - MARGIN * 2, h: road }, 'cobblestone')
    if (r < rows) ys.push(y + road)
    y += road + (rowH[r] ?? 0)
  }

  // Plaza with a well at the crossing nearest the centre.
  const cx =
    MARGIN +
    road * Math.round(cols / 2) +
    colW.slice(0, Math.round(cols / 2)).reduce((a, b) => a + b, 0)
  const cy =
    MARGIN +
    road * Math.round(rows / 2) +
    rowH.slice(0, Math.round(rows / 2)).reduce((a, b) => a + b, 0)
  const plaza: Rect = { x: cx - 1, y: cy - 1, w: road + 2, h: road + 2 }
  fillRect(res.tiles, plaza, 'cobblestone')
  res.props.push(prop('well', cx + Math.floor(road / 2), cy + Math.floor(road / 2)))

  let names = [...BUILDING_NAMES]
  let number = 1
  let made = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const block: Rect = { x: xs[c], y: ys[r], w: colW[c], h: rowH[r] }
      if (made >= blocks) {
        // Unused grid slots become open fields with a few trees.
        scatterTrees(res, block, rng, 0.04)
        continue
      }
      made++
      const lots = splitBlock(res, block, rng)
      for (const lot of lots) {
        if (rng.chance(density) && lot.w >= 4 && lot.h >= 4) {
          const name =
            names.length && rng.chance(0.35)
              ? names.splice(rng.int(0, names.length - 1), 1)[0]
              : 'House'
          if (!names.length) names = [...BUILDING_NAMES]
          placeBuilding(res, lot, rng, name, number++)
        } else if (rng.chance(0.5)) {
          scatterTrees(res, lot, rng, 0.12)
        } else {
          fenceGarden(res, lot)
        }
      }
    }
  }
  res.entrance = { x: MARGIN, y: cy }
  return res
}

interface Lot extends Rect {
  /** Side of the lot facing the nearest path or street. */
  front: 'n' | 's' | 'e' | 'w'
}

/** Splits a block with a 1-wide dirt side path, giving 2–6 lots facing it. */
function splitBlock(res: GenResult, b: Rect, rng: Rng): Lot[] {
  const lots: Lot[] = []
  if (rng.chance(0.5)) {
    // Vertical path down the middle; lots face east/west onto it.
    const px = b.x + Math.floor(b.w / 2)
    fillRect(res.tiles, { x: px, y: b.y, w: 1, h: b.h }, 'dirt')
    const n = b.h >= 10 ? 2 : 1
    for (let i = 0; i < n; i++) {
      const ly = b.y + Math.round((b.h * i) / n)
      const lh = b.y + Math.round((b.h * (i + 1)) / n) - ly
      lots.push({ x: b.x, y: ly, w: px - b.x, h: lh, front: 'e' })
      lots.push({ x: px + 1, y: ly, w: b.x + b.w - px - 1, h: lh, front: 'w' })
    }
  } else {
    const py = b.y + Math.floor(b.h / 2)
    fillRect(res.tiles, { x: b.x, y: py, w: b.w, h: 1 }, 'dirt')
    const n = b.w >= 12 ? 2 : 1
    for (let i = 0; i < n; i++) {
      const lx = b.x + Math.round((b.w * i) / n)
      const lw = b.x + Math.round((b.w * (i + 1)) / n) - lx
      lots.push({ x: lx, y: b.y, w: lw, h: py - b.y, front: 's' })
      lots.push({ x: lx, y: py + 1, w: lw, h: b.y + b.h - py - 1, front: 'n' })
    }
  }
  return lots
}

function placeBuilding(res: GenResult, lot: Lot, rng: Rng, name: string, number: number) {
  // Leave a 1-cell yard on every side.
  const w = rng.int(Math.min(4, lot.w - 2), lot.w - 2)
  const h = rng.int(Math.min(4, lot.h - 2), lot.h - 2)
  const b: Rect = {
    x:
      lot.front === 'w'
        ? lot.x + 1
        : lot.front === 'e'
          ? lot.x + lot.w - 1 - w
          : lot.x + 1 + rng.int(0, lot.w - 2 - w),
    y:
      lot.front === 'n'
        ? lot.y + 1
        : lot.front === 's'
          ? lot.y + lot.h - 1 - h
          : lot.y + 1 + rng.int(0, lot.h - 2 - h),
    w,
    h,
  }
  fillRect(res.tiles, b, 'wood-floor')
  rectOutlineWalls(res.walls, b)
  // Door on the side facing the path, plus a dirt step outside it.
  const dx = b.x + rng.int(1, Math.max(1, b.w - 2))
  const dy = b.y + rng.int(1, Math.max(1, b.h - 2))
  switch (lot.front) {
    case 'n':
      res.walls[edgeKey('h', dx, b.y)] = DOOR
      res.tiles[cellKey(dx, b.y - 1)] = 'dirt'
      break
    case 's':
      res.walls[edgeKey('h', dx, b.y + b.h)] = DOOR
      res.tiles[cellKey(dx, b.y + b.h)] = 'dirt'
      break
    case 'w':
      res.walls[edgeKey('v', b.x, dy)] = DOOR
      res.tiles[cellKey(b.x - 1, dy)] = 'dirt'
      break
    case 'e':
      res.walls[edgeKey('v', b.x + b.w, dy)] = DOOR
      res.tiles[cellKey(b.x + b.w, dy)] = 'dirt'
      break
  }
  // A little furniture so interiors aren't empty.
  if (b.w >= 4 && b.h >= 4) {
    res.props.push(prop(name === 'Tavern' ? 'table' : 'bed', b.x + b.w - 2, b.y + 1))
    if (rng.chance(0.6))
      res.props.push(prop(rng.chance(0.5) ? 'barrel' : 'chest', b.x + 1, b.y + b.h - 2))
  }
  res.rooms.push({ ...b, id: `room-${number}`, number, name })
  res.notes.push({ kind: 'room', x: b.x + 1, y: b.y + 1, text: name, number })
}

function scatterTrees(res: GenResult, area: Rect, rng: Rng, chance: number) {
  for (let y = area.y; y + 1 < area.y + area.h; y += 2)
    for (let x = area.x; x + 1 < area.x + area.w; x += 2)
      if (rng.chance(chance * 2)) res.props.push(prop('tree', x, y))
}

function fenceGarden(res: GenResult, lot: Lot) {
  if (lot.w < 3 || lot.h < 3) return
  const g: Rect = { x: lot.x + 1, y: lot.y + 1, w: lot.w - 2, h: lot.h - 2 }
  fillRect(res.tiles, g, 'dirt')
  for (let x = g.x; x < g.x + g.w; x++) {
    res.props.push(prop('fence', x, g.y))
    if (g.h > 1) res.props.push(prop('fence', x, g.y + g.h - 1))
  }
}
