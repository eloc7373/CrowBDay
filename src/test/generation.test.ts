import { beforeEach, describe, expect, it } from 'vitest'
import { cellKey, parseCellKey, type Cell } from '../lib/geometry'
import { edgeBetween, regions } from '../mapcreator/generation/common'
import {
  generationChanges,
  runGenerator,
  type GeneratorKind,
  type GenResult,
} from '../mapcreator/generation'
import { createEmptyMap } from '../mapcreator/layers/model'
import { useMapStore } from '../mapcreator/store/mapStore'
import { paintChanges } from '../mapcreator/tools/paint'

const KINDS: GeneratorKind[] = ['cave', 'dungeon', 'tavern', 'village']

/** Cells reachable from `start` without crossing a wall (doors, incl. secret, are passable). */
function reachable(res: GenResult, start: Cell): Set<string> {
  const seen = new Set([cellKey(start.x, start.y)])
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: c.x + dx, y: c.y + dy }
      if (n.x < 0 || n.y < 0 || n.x >= res.width || n.y >= res.height) continue
      const k = cellKey(n.x, n.y)
      if (seen.has(k)) continue
      const wall = res.walls[edgeBetween(c, n)]
      if (wall && !wall.door) continue
      seen.add(k)
      queue.push(n)
    }
  }
  return seen
}

describe('generators are deterministic', () => {
  for (const kind of KINDS) {
    it(`${kind}: same seed + params → identical; different seed → different`, () => {
      const a = runGenerator(kind, {}, 'alpha')
      const b = runGenerator(kind, {}, 'alpha')
      const c = runGenerator(kind, {}, 'beta')
      expect(b).toEqual(a)
      expect(c).not.toEqual(a)
      // Output stays inside its own bounds.
      for (const k of Object.keys(a.tiles)) {
        const p = parseCellKey(k)
        expect(p.x >= 0 && p.y >= 0 && p.x < a.width && p.y < a.height).toBe(true)
      }
      expect(Object.keys(a.tiles).length).toBe(a.width * a.height)
    })
  }

  it('different parameters change the result', () => {
    expect(runGenerator('cave', { fillPercent: 55 }, 's')).not.toEqual(
      runGenerator('cave', { fillPercent: 40 }, 's'),
    )
    expect(runGenerator('dungeon', { corridorWidth: 2 }, 's')).not.toEqual(
      runGenerator('dungeon', { corridorWidth: 1 }, 's'),
    )
  })
})

describe('dungeon', () => {
  const seeds = Array.from({ length: 25 }, (_, i) => `seed-${i}`)

  it('a flood fill from the entrance reaches every room (25 seeds, both corridor widths)', () => {
    for (const seed of seeds) {
      for (const corridorWidth of [1, 2] as const) {
        const res = runGenerator(
          'dungeon',
          { width: 50, height: 40, corridorWidth, doorChance: 1, secretDoors: 3 },
          seed,
        )
        expect(res.rooms.length, seed).toBeGreaterThan(1)
        const seen = reachable(res, res.entrance!)
        for (const r of res.rooms) {
          let hit = false
          for (let y = r.y; y < r.y + r.h && !hit; y++)
            for (let x = r.x; x < r.x + r.w && !hit; x++) hit = seen.has(cellKey(x, y))
          expect(hit, `${seed} w${corridorWidth} ${r.id}`).toBe(true)
        }
        // Walls keep the party inside the dungeon: no rock cell is reachable.
        for (const k of seen) expect(res.tiles[k], `${seed} ${k}`).not.toBe('rock')
      }
    }
  })

  it('places doors, the requested secret doors, stairs and numbered room notes', () => {
    const res = runGenerator('dungeon', { secretDoors: 2, doorChance: 1, stairs: true }, 'doors')
    const walls = Object.values(res.walls)
    expect(walls.some((w) => w.door && !w.secret)).toBe(true)
    // Secret doors may span 1–2 edges (corridor width); count groups via the result is fiddly, so check ≥ 2 edges.
    expect(walls.filter((w) => w.secret).length).toBeGreaterThanOrEqual(2)
    expect(Object.values(res.tiles)).toContain('stairs-up')
    expect(Object.values(res.tiles)).toContain('stairs-down')
    expect(res.notes.map((n) => n.number)).toEqual(res.rooms.map((r) => r.number))
    expect(res.rooms[0].name).toBe('Entrance')
    expect(runGenerator('dungeon', { secretDoors: 0 }, 'doors').walls).not.toContainEqual({
      door: true,
      secret: true,
    })
  })

  it('respects room size limits', () => {
    const res = runGenerator(
      'dungeon',
      { width: 60, height: 60, minRoomSize: 5, maxRoomSize: 7 },
      'sizes',
    )
    for (const r of res.rooms) {
      expect(Math.min(r.w, r.h)).toBeGreaterThanOrEqual(5)
      expect(Math.max(r.w, r.h)).toBeLessThanOrEqual(7)
    }
  })
})

describe('cave', () => {
  it('connect = true leaves one connected cave system', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const res = runGenerator('cave', { width: 60, height: 45, connect: true }, seed)
      const open = regions(res.width, res.height, (x, y) => res.tiles[cellKey(x, y)] !== 'rock')
      expect(open, seed).toHaveLength(1)
      expect(reachable(res, res.entrance!).size).toBe(open[0].length)
    }
  })

  it('connect = false drops caves smaller than the minimum size', () => {
    const res = runGenerator(
      'cave',
      { width: 60, height: 45, connect: false, minCaveSize: 30 },
      'small',
    )
    const open = regions(res.width, res.height, (x, y) => res.tiles[cellKey(x, y)] !== 'rock')
    for (const r of open) expect(r.length).toBeGreaterThanOrEqual(30)
  })

  it('walls separate floor from rock', () => {
    const res = runGenerator('cave', {}, 'walls')
    expect(Object.keys(res.walls).length).toBeGreaterThan(0)
    expect(Object.values(res.walls).every((w) => !w.door)).toBe(true)
  })
})

describe('tavern and village', () => {
  it('tavern has the requested rooms, a front door and furniture', () => {
    for (const roomCount of [1, 3, 6]) {
      const res = runGenerator(
        'tavern',
        { roomCount, footprintWidth: 20, footprintHeight: 14 },
        `t${roomCount}`,
      )
      expect(res.rooms).toHaveLength(roomCount)
      expect(res.rooms[0].name).toBe('Common room')
      expect(Object.values(res.walls).filter((w) => w.door).length).toBeGreaterThanOrEqual(
        roomCount,
      )
      const ids = res.props.map((p) => p.defId)
      expect(ids).toContain('shop-counter')
      expect(ids).toContain('campfire')
      expect(ids).toContain('table')
      // Every room is reachable from the front door.
      const seen = reachable(res, { x: res.entrance!.x, y: res.entrance!.y - 1 })
      for (const r of res.rooms) expect(seen.has(cellKey(r.x + 1, r.y + 1)), r.name).toBe(true)
    }
    const bare = runGenerator('tavern', { bar: false, hearth: false, tables: false }, 'bare')
    expect(bare.props.map((p) => p.defId)).not.toContain('shop-counter')
    // "tables" controls the common room; side rooms like the kitchen keep their own furniture.
    const hall = bare.rooms[0]
    expect(bare.props.filter((p) => p.defId === 'table' && p.y >= hall.y)).toEqual([])
  })

  it('village has streets, side paths, buildings with doors and a well', () => {
    const res = runGenerator('village', { blocks: 6, roadWidth: 2, density: 1 }, 'town')
    const tiles = Object.values(res.tiles)
    expect(tiles).toContain('cobblestone')
    expect(tiles).toContain('dirt')
    expect(res.rooms.length).toBeGreaterThan(4)
    expect(Object.values(res.walls).filter((w) => w.door)).toHaveLength(res.rooms.length)
    expect(res.props.map((p) => p.defId)).toContain('well')
    const sparse = runGenerator('village', { blocks: 6, roadWidth: 2, density: 0 }, 'town')
    expect(sparse.rooms).toHaveLength(0)
    expect(runGenerator('village', { blocks: 9, roadWidth: 3 }, 'big').width).toBeGreaterThan(
      res.width,
    )
  })
})

describe('merging into a map', () => {
  beforeEach(() => {
    useMapStore.getState().loadDoc(createEmptyMap({ width: 20, height: 15 }))
    const s = useMapStore.getState()
    s.commit(
      'Paint',
      paintChanges(
        s.doc,
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        'grass',
      ),
    )
    s.commit('Note', [
      {
        coll: 'notes',
        key: 'n1',
        after: { id: 'n1', kind: 'room', x: 0, y: 0, text: 'Old', number: 4 },
      },
    ])
  })

  for (const kind of KINDS) {
    for (const mode of ['replace', 'overlay'] as const) {
      it(`${kind} (${mode}) is one undo step and undo restores the prior map exactly`, () => {
        const s = useMapStore.getState
        const before = structuredClone(s().doc)
        const res = runGenerator(kind, { width: 30, height: 25 }, 'merge')
        s().commit('Generate', generationChanges(s().doc, res, mode))
        expect(s().past).toHaveLength(3)
        expect(s().doc.seed).toBe('merge')
        if (mode === 'replace') {
          expect(s().doc.width).toBe(res.width)
          expect(Object.keys(s().doc.tiles)).toHaveLength(res.width * res.height)
          expect(Object.values(s().doc.notes).map((n) => n.text)).not.toContain('Old')
        } else {
          expect(s().doc.width).toBe(20)
          expect(Object.values(s().doc.notes).some((n) => n.text === 'Old')).toBe(true)
          // Generated room numbers continue after the existing marker (#4).
          const numbers = Object.values(s().doc.notes)
            .filter((n) => n.text !== 'Old')
            .map((n) => n.number ?? 0)
          if (numbers.length) expect(Math.min(...numbers)).toBe(5)
        }
        s().undo()
        expect(s().doc).toEqual(before)
        s().redo()
        expect(s().doc.seed).toBe('merge')
      })
    }
  }
})
