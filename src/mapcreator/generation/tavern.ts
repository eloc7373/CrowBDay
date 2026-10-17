// Tavern / building interior generator.
// The building sits on grass with a cobbled street along its front (bottom).
// The front part is the common room; the back strip is split into side rooms
// (kitchen, storage, bedrooms…), each with a door into the common room.
// Optional furnishings: bar counter, hearth and tables with chairs.

import { cellKey, type Rect } from '../../lib/geometry'
import { edgeKey } from '../layers/model'
import {
  clampInt,
  DOOR,
  emptyResult,
  fillRect,
  Occupancy,
  prop,
  rectOutlineWalls,
  rngFor,
  WALL,
  type GenResult,
} from './common'

export interface TavernParams {
  /** Total rooms including the common room, 1–6. */
  roomCount: number
  /** Building footprint in cells. */
  footprintWidth: number
  footprintHeight: number
  bar: boolean
  hearth: boolean
  tables: boolean
}

export const TAVERN_DEFAULTS: TavernParams = {
  roomCount: 4,
  footprintWidth: 18,
  footprintHeight: 14,
  bar: true,
  hearth: true,
  tables: true,
}

const SIDE_ROOMS = ['Kitchen', 'Storage', 'Bedroom', 'Bedroom', 'Office', 'Bedroom']
const MARGIN = 2

export function generateTavern(params: Partial<TavernParams>, seed: string): GenResult {
  const p = { ...TAVERN_DEFAULTS, ...params }
  const bw = clampInt(p.footprintWidth, 8, 60, TAVERN_DEFAULTS.footprintWidth)
  const bh = clampInt(p.footprintHeight, 8, 50, TAVERN_DEFAULTS.footprintHeight)
  // Side rooms need at least 3 cells of width each.
  const maxRooms = Math.max(1, Math.min(6, 1 + Math.floor(bw / 3)))
  const roomCount = clampInt(p.roomCount, 1, maxRooms, 4)
  const rng = rngFor('tavern', seed)

  const W = bw + MARGIN * 2
  const H = bh + MARGIN * 2 + 1 // +1 row for the street
  const res = emptyResult('tavern', seed, W, H)
  const building: Rect = { x: MARGIN, y: MARGIN, w: bw, h: bh }

  fillRect(res.tiles, { x: 0, y: 0, w: W, h: H }, 'grass')
  fillRect(res.tiles, { x: 0, y: H - 2, w: W, h: 2 }, 'cobblestone')
  fillRect(res.tiles, building, 'wood-floor')
  rectOutlineWalls(res.walls, building)

  // Front door, roughly centred on the bottom wall.
  const doorX = building.x + Math.floor(bw / 2) + rng.int(-1, 1)
  res.walls[edgeKey('h', doorX, building.y + bh)] = DOOR
  res.entrance = { x: doorX, y: building.y + bh }

  const occ = new Occupancy()
  // Keep the walkway from the front door clear.
  occ.take(doorX, building.y + bh - 2, 1, 2)

  let hall: Rect = building
  const sideRooms: (Rect & { name: string })[] = []
  if (roomCount > 1) {
    const depth = clampInt(Math.round(bh * 0.38), 3, bh - 5, 4)
    hall = { x: building.x, y: building.y + depth, w: bw, h: bh - depth }
    // Wall between the back strip and the hall.
    for (let x = building.x; x < building.x + bw; x++) res.walls[edgeKey('h', x, hall.y)] = WALL
    // Split the back strip into side rooms with some jitter.
    const n = roomCount - 1
    const cuts: number[] = [building.x]
    for (let i = 1; i < n; i++) {
      const even = building.x + Math.round((bw * i) / n)
      cuts.push(
        Math.min(building.x + bw - 3 * (n - i), Math.max(cuts[i - 1] + 3, even + rng.int(-1, 1))),
      )
    }
    cuts.push(building.x + bw)
    for (let i = 0; i < n; i++) {
      const r = {
        x: cuts[i],
        y: building.y,
        w: cuts[i + 1] - cuts[i],
        h: depth,
        name: SIDE_ROOMS[i],
      }
      sideRooms.push(r)
      if (i > 0) for (let y = r.y; y < r.y + r.h; y++) res.walls[edgeKey('v', r.x, y)] = WALL
      // Door from the hall into this room.
      const dx = r.x + rng.int(1, Math.max(1, r.w - 2))
      res.walls[edgeKey('h', dx, hall.y)] = DOOR
      occ.take(dx, hall.y, 1, 1)
      furnishSideRoom(res, r, occ, rng)
    }
  }

  const inner: Rect = { x: hall.x, y: hall.y, w: hall.w, h: hall.h }
  if (p.bar && hall.w >= 8) {
    // Counter along the back of the hall, barrels behind it.
    const cx = hall.x + hall.w - 5
    const cy = hall.y + 2
    if (occ.free(cx, cy, 3, 1, inner)) {
      res.props.push(prop('shop-counter', cx, cy))
      occ.take(cx, cy - 2, 4, 3)
      for (let i = 0; i < 2; i++)
        if (occ.free(cx + i * 2, hall.y, 1, 1, inner))
          res.props.push(prop('barrel', cx + i * 2, hall.y))
    }
  }
  if (p.hearth) {
    const hy = hall.y + Math.floor(hall.h / 2)
    if (occ.free(hall.x, hy, 1, 1, inner)) {
      fillRect(res.tiles, { x: hall.x, y: hy - 1, w: 1, h: 3 }, 'stone-floor')
      res.props.push(prop('campfire', hall.x, hy))
      occ.take(hall.x, hy - 1, 2, 3)
    }
  }
  if (p.tables) {
    // Rows of 2×1 tables with chairs, leaving aisles between them.
    for (let y = hall.y + 2; y + 2 < hall.y + hall.h - 1; y += 4) {
      for (let x = hall.x + 2; x + 2 < hall.x + hall.w - 1; x += 4) {
        if (!occ.free(x, y - 1, 2, 3, inner) || rng.chance(0.2)) continue
        res.props.push(prop('table', x, y))
        occ.take(x, y - 1, 2, 3)
        for (const cx of [x, x + 1]) {
          if (rng.chance(0.75)) res.props.push(prop('chair', cx, y - 1))
          if (rng.chance(0.75)) res.props.push(prop('chair', cx, y + 1, 180))
        }
      }
    }
  }

  const all = [{ ...hall, name: 'Common room' }, ...sideRooms]
  all.forEach((r, i) => {
    res.rooms.push({ ...r, id: `room-${i + 1}`, number: i + 1, name: r.name })
    res.notes.push({ kind: 'room', x: r.x, y: r.y, text: r.name, number: i + 1 })
  })
  return res
}

function furnishSideRoom(
  res: GenResult,
  r: Rect & { name: string },
  occ: Occupancy,
  rng: ReturnType<typeof rngFor>,
) {
  // The room-marker note sits at the top-left cell.
  occ.take(r.x, r.y, 1, 1)
  const place = (defId: string, w: number, h: number, tries = 12) => {
    for (let t = 0; t < tries; t++) {
      const x = r.x + rng.int(0, Math.max(0, r.w - w))
      const y = r.y + rng.int(0, Math.max(0, r.h - h - 1))
      if (occ.free(x, y, w, h, r)) {
        res.props.push(prop(defId, x, y))
        occ.take(x, y, w, h)
        return
      }
    }
  }
  switch (r.name) {
    case 'Kitchen':
      place('table', 2, 1)
      place('barrel', 1, 1)
      place('crate', 1, 1)
      break
    case 'Storage':
      for (let i = 0; i < 4; i++) place(rng.chance(0.5) ? 'barrel' : 'crate', 1, 1)
      break
    case 'Bedroom':
      place('bed', 1, 2)
      place('chest', 1, 1)
      break
    default:
      place('bookshelf', 2, 1)
      place('chair', 1, 1)
  }
  // Tag the room cells so they read differently from the hall.
  if (r.name === 'Kitchen' || r.name === 'Storage') {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) res.tiles[cellKey(x, y)] = 'stone-floor'
  }
}
