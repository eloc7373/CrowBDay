import { describe, expect, it } from 'vitest'
import {
  brushCells,
  cellLabel,
  columnLabel,
  ellipseCells,
  lineCells,
  rectCells,
} from '../lib/geometry'
import { constrainVertex, edgesBetweenVertices, nearestEdge } from '../mapcreator/layers/model'
import { measure } from '../mapcreator/tools/measure'

describe('cell labels', () => {
  it('uses spreadsheet column letters and 1-based rows', () => {
    expect(columnLabel(0)).toBe('A')
    expect(columnLabel(25)).toBe('Z')
    expect(columnLabel(26)).toBe('AA')
    expect(columnLabel(27)).toBe('AB')
    expect(columnLabel(701)).toBe('ZZ')
    expect(cellLabel(2, 6)).toBe('C7')
  })
})

describe('shapes', () => {
  it('draws a connected Bresenham line including both ends', () => {
    const line = lineCells({ x: 0, y: 0 }, { x: 5, y: 2 })
    expect(line[0]).toEqual({ x: 0, y: 0 })
    expect(line[line.length - 1]).toEqual({ x: 5, y: 2 })
    expect(line).toHaveLength(6)
  })

  it('brush sizes produce size² cells', () => {
    for (let s = 1; s <= 8; s++) expect(brushCells(10, 10, s)).toHaveLength(s * s)
    expect(brushCells(10, 10, 3)).toContainEqual({ x: 9, y: 9 })
  })

  it('rectangle fill and outline', () => {
    expect(rectCells({ x: 0, y: 0 }, { x: 3, y: 2 }, 'fill')).toHaveLength(12)
    expect(rectCells({ x: 3, y: 2 }, { x: 0, y: 0 }, 'outline')).toHaveLength(10)
  })

  it('ellipse fill is symmetric and outline is a subset', () => {
    const fill = ellipseCells({ x: 0, y: 0 }, { x: 8, y: 8 }, 'fill')
    const outline = ellipseCells({ x: 0, y: 0 }, { x: 8, y: 8 }, 'outline')
    const key = (c: { x: number; y: number }) => `${c.x},${c.y}`
    const set = new Set(fill.map(key))
    for (const c of fill) expect(set.has(key({ x: 8 - c.x, y: c.y }))).toBe(true)
    for (const c of outline) expect(set.has(key(c))).toBe(true)
    expect(outline.length).toBeLessThan(fill.length)
    expect(ellipseCells({ x: 4, y: 4 }, { x: 4, y: 4 }, 'fill')).toEqual([{ x: 4, y: 4 }])
  })
})

describe('wall edges', () => {
  it('builds unit edges along the dominant axis', () => {
    expect(edgesBetweenVertices({ x: 1, y: 2 }, { x: 4, y: 3 })).toEqual([
      'h:1,2',
      'h:2,2',
      'h:3,2',
    ])
    expect(edgesBetweenVertices({ x: 2, y: 5 }, { x: 2, y: 3 })).toEqual(['v:2,3', 'v:2,4'])
    expect(constrainVertex({ x: 1, y: 2 }, { x: 4, y: 3 })).toEqual({ x: 4, y: 2 })
  })

  it('finds the nearest edge to a point', () => {
    expect(nearestEdge(3.5, 2.05).key).toBe('h:3,2')
    expect(nearestEdge(3.95, 2.5).key).toBe('v:4,2')
  })
})

describe('measure', () => {
  const o = { x: 0, y: 0 }
  it('straight lines count each square', () => {
    expect(measure(o, { x: 6, y: 0 }, 'alternating', 5)).toEqual({ squares: 6, feet: 30 })
  })
  it('alternating diagonals: 5, 10, 5, 10…', () => {
    expect(measure(o, { x: 1, y: 1 }, 'alternating', 5).feet).toBe(5)
    expect(measure(o, { x: 2, y: 2 }, 'alternating', 5).feet).toBe(15)
    expect(measure(o, { x: 3, y: 3 }, 'alternating', 5).feet).toBe(20)
    expect(measure(o, { x: 4, y: 4 }, 'alternating', 5).feet).toBe(30)
    expect(measure(o, { x: 5, y: 2 }, 'alternating', 5).feet).toBe(30)
  })
  it('5 ft per diagonal', () => {
    expect(measure(o, { x: 4, y: 4 }, 'five', 5).feet).toBe(20)
  })
  it('euclidean', () => {
    expect(measure(o, { x: 3, y: 4 }, 'euclidean', 5).feet).toBe(25)
  })
})
