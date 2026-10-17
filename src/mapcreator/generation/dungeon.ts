// Dungeon generator: binary space partitioning (BSP).
// 1. Recursively split the map into leaves until they are too small to split.
// 2. Put one room in each leaf.
// 3. Walking back up the tree, join the two halves of every split with an
//    L-shaped corridor between their closest rooms. Because every split is
//    joined, all rooms form one connected network (reachable from the entrance).
// 4. Walls go on every floor/rock boundary. Where a corridor meets a room, the
//    doorway gets a door (doorChance) or stays open; some doors become secret.

import { cellKey, type Cell, type Rect } from '../../lib/geometry'
import { type Rng } from '../../lib/rng'
import { MAX_MAP_SIZE, parseEdgeKey } from '../layers/model'
import {
  center,
  clampInt,
  DOOR,
  edgeBetween,
  emptyResult,
  rngFor,
  SECRET_DOOR,
  wallsAroundFloor,
  type GenResult,
  type GenRoom,
} from './common'

export interface DungeonParams {
  width: number
  height: number
  minRoomSize: number
  maxRoomSize: number
  corridorWidth: 1 | 2
  /** 0–1: chance each doorway gets a door (otherwise an open archway). */
  doorChance: number
  /** 0–3 doors turned into secret doors. */
  secretDoors: number
  stairs: boolean
}

export const DUNGEON_DEFAULTS: DungeonParams = {
  width: 40,
  height: 30,
  minRoomSize: 4,
  maxRoomSize: 9,
  corridorWidth: 1,
  doorChance: 0.6,
  secretDoors: 1,
  stairs: true,
}

interface Leaf extends Rect {
  a?: Leaf
  b?: Leaf
  room?: Rect
}

function split(leaf: Leaf, minLeaf: number, rng: Rng, depth: number) {
  if (depth > 12) return
  const canV = leaf.w >= minLeaf * 2
  const canH = leaf.h >= minLeaf * 2
  if (!canV && !canH) return
  let vertical: boolean
  if (canV && canH)
    vertical = leaf.w > leaf.h * 1.25 ? true : leaf.h > leaf.w * 1.25 ? false : rng.chance(0.5)
  else vertical = canV
  const size = vertical ? leaf.w : leaf.h
  const at = rng.int(minLeaf, size - minLeaf)
  if (vertical) {
    leaf.a = { x: leaf.x, y: leaf.y, w: at, h: leaf.h }
    leaf.b = { x: leaf.x + at, y: leaf.y, w: leaf.w - at, h: leaf.h }
  } else {
    leaf.a = { x: leaf.x, y: leaf.y, w: leaf.w, h: at }
    leaf.b = { x: leaf.x, y: leaf.y + at, w: leaf.w, h: leaf.h - at }
  }
  split(leaf.a, minLeaf, rng, depth + 1)
  split(leaf.b, minLeaf, rng, depth + 1)
}

function roomsOf(leaf: Leaf): Rect[] {
  if (leaf.room) return [leaf.room]
  return [...(leaf.a ? roomsOf(leaf.a) : []), ...(leaf.b ? roomsOf(leaf.b) : [])]
}

export function generateDungeon(params: Partial<DungeonParams>, seed: string): GenResult {
  const p = { ...DUNGEON_DEFAULTS, ...params }
  const w = clampInt(p.width, 10, MAX_MAP_SIZE, DUNGEON_DEFAULTS.width)
  const h = clampInt(p.height, 10, MAX_MAP_SIZE, DUNGEON_DEFAULTS.height)
  const minRoom = clampInt(p.minRoomSize, 3, Math.min(w, h) - 2, 4)
  const maxRoom = clampInt(p.maxRoomSize, minRoom, Math.max(minRoom, Math.min(w, h) - 2), 9)
  const cw = p.corridorWidth === 2 ? 2 : 1
  const doorChance = Math.min(1, Math.max(0, Number.isFinite(p.doorChance) ? p.doorChance : 0.6))
  const secretCount = clampInt(p.secretDoors, 0, 3, 1)
  const rng = rngFor('dungeon', seed)

  // Leaves need room for the smallest room plus a 1-cell rock margin each side.
  const root: Leaf = { x: 0, y: 0, w, h }
  split(root, minRoom + 2, rng, 0)

  const roomCell = new Int16Array(w * h).fill(-1)
  const corridor = new Uint8Array(w * h)
  const rooms: Rect[] = []

  const placeRooms = (leaf: Leaf) => {
    if (leaf.a || leaf.b) {
      if (leaf.a) placeRooms(leaf.a)
      if (leaf.b) placeRooms(leaf.b)
      return
    }
    const rw = rng.int(minRoom, Math.max(minRoom, Math.min(maxRoom, leaf.w - 2)))
    const rh = rng.int(minRoom, Math.max(minRoom, Math.min(maxRoom, leaf.h - 2)))
    const rx = leaf.x + rng.int(1, Math.max(1, leaf.w - rw - 1))
    const ry = leaf.y + rng.int(1, Math.max(1, leaf.h - rh - 1))
    leaf.room = { x: rx, y: ry, w: Math.min(rw, w - rx - 1), h: Math.min(rh, h - ry - 1) }
    const idx = rooms.length
    rooms.push(leaf.room)
    for (let y = leaf.room.y; y < leaf.room.y + leaf.room.h; y++)
      for (let x = leaf.room.x; x < leaf.room.x + leaf.room.w; x++) roomCell[y * w + x] = idx
  }
  placeRooms(root)

  const carve = (x: number, y: number) => {
    for (let dy = 0; dy < cw; dy++)
      for (let dx = 0; dx < cw; dx++) {
        const cx = Math.min(w - 2, Math.max(1, x + dx))
        const cy = Math.min(h - 2, Math.max(1, y + dy))
        if (roomCell[cy * w + cx] < 0) corridor[cy * w + cx] = 1
      }
  }

  const connect = (leaf: Leaf) => {
    if (!leaf.a || !leaf.b) return
    connect(leaf.a)
    connect(leaf.b)
    // Join the closest pair of rooms across this split.
    let best: [Rect, Rect] | null = null
    let bestD = Infinity
    for (const ra of roomsOf(leaf.a))
      for (const rb of roomsOf(leaf.b)) {
        const ca = center(ra)
        const cb = center(rb)
        const d = Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y)
        if (d < bestD) {
          bestD = d
          best = [ra, rb]
        }
      }
    if (!best) return
    const a = center(best[0])
    const b = center(best[1])
    const horizontalFirst = rng.chance(0.5)
    const corner = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y }
    for (const [from, to] of [
      [a, corner],
      [corner, b],
    ] as const) {
      const sx = Math.sign(to.x - from.x)
      const sy = Math.sign(to.y - from.y)
      let x = from.x
      let y = from.y
      carve(x, y)
      while (x !== to.x || y !== to.y) {
        x += sx
        y += sy
        carve(x, y)
      }
    }
  }
  connect(root)

  const isFloor = (x: number, y: number) => roomCell[y * w + x] >= 0 || corridor[y * w + x] === 1
  const res = emptyResult('dungeon', seed, w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) res.tiles[cellKey(x, y)] = isFloor(x, y) ? 'stone-floor' : 'rock'
  res.walls = wallsAroundFloor(w, h, isFloor)

  // Doorways: edges between a room cell and a corridor cell, grouped into runs.
  type Edge = { key: string; room: number; o: 'h' | 'v'; x: number; y: number }
  const doorEdges: Edge[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const r = roomCell[y * w + x]
      if (r < 0) continue
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        if (corridor[ny * w + nx] !== 1) continue
        const key = edgeBetween({ x, y }, { x: nx, y: ny })
        const e = parseEdgeKey(key)
        doorEdges.push({ key, room: r, o: e.o, x: e.x, y: e.y })
      }
    }
  doorEdges.sort(
    (a, b) =>
      a.room - b.room ||
      a.o.localeCompare(b.o) ||
      (a.o === 'h' ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y),
  )
  const groups: Edge[][] = []
  for (const e of doorEdges) {
    const g = groups[groups.length - 1]
    const last = g?.[g.length - 1]
    const contiguous =
      last &&
      last.room === e.room &&
      last.o === e.o &&
      (e.o === 'h' ? last.y === e.y && e.x === last.x + 1 : last.x === e.x && e.y === last.y + 1)
    if (contiguous) g.push(e)
    else groups.push([e])
  }

  // Short runs (a corridor entering head-on) are doorways; longer runs are a
  // corridor running alongside a room and stay open so nothing is cut off.
  const doorGroups: Edge[][] = []
  const openings: Edge[][] = []
  for (const g of groups) {
    if (g.length > cw) continue
    if (rng.chance(doorChance)) {
      for (const e of g) res.walls[e.key] = DOOR
      doorGroups.push(g)
    } else openings.push(g)
  }
  // Secret doors: prefer existing doors, then archways.
  const pool = [...doorGroups, ...openings]
  for (let i = 0; i < secretCount && pool.length; i++) {
    const g = pool.splice(rng.int(0, pool.length - 1), 1)[0]
    for (const e of g) res.walls[e.key] = SECRET_DOOR
  }

  // Number rooms by walking distance from the entrance (top-left-most room).
  const entranceIdx = rooms.reduce(
    (best, r, i) => (r.x + r.y < rooms[best].x + rooms[best].y ? i : best),
    0,
  )
  const entrance = center(rooms[entranceIdx])
  const dist = bfs(w, h, isFloor, entrance)
  const order = rooms
    .map((r, i) => ({ i, d: dist[center(r).y * w + center(r).x] }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
  const genRooms: GenRoom[] = order.map(({ i }, n) => ({
    ...rooms[i],
    id: `room-${n + 1}`,
    number: n + 1,
    name: n === 0 ? 'Entrance' : `Room ${n + 1}`,
  }))
  res.rooms = genRooms
  res.entrance = entrance
  for (const r of genRooms)
    res.notes.push({ kind: 'room', x: r.x, y: r.y, text: r.name, number: r.number })

  if (p.stairs) {
    res.tiles[cellKey(entrance.x, entrance.y)] = 'stairs-up'
    if (genRooms.length > 1) {
      const last = center(genRooms[genRooms.length - 1])
      res.tiles[cellKey(last.x, last.y)] = 'stairs-down'
    }
  }
  return res
}

/** Steps from `start` to every floor cell (walls between floor cells don't exist here). */
function bfs(w: number, h: number, isFloor: (x: number, y: number) => boolean, start: Cell) {
  const dist = new Int32Array(w * h).fill(1 << 30)
  dist[start.y * w + start.x] = 0
  const queue: Cell[] = [start]
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi]
    const d = dist[c.y * w + c.x]
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = c.x + dx
      const ny = c.y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !isFloor(nx, ny)) continue
      if (dist[ny * w + nx] <= d + 1) continue
      dist[ny * w + nx] = d + 1
      queue.push({ x: nx, y: ny })
    }
  }
  return dist
}
