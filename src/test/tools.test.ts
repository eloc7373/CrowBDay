import { describe, expect, it } from 'vitest'
import { applyChanges } from '../mapcreator/store/history'
import { createEmptyMap, edgeKey, type MapDoc, type PlacedProp } from '../mapcreator/layers/model'
import { eraseChanges, fillChanges, floodRegion, paintChanges } from '../mapcreator/tools/paint'
import {
  clampDelta,
  deleteSelection,
  hitTest,
  itemsInRect,
  reorientProps,
  stampAnchor,
  transformSelection,
} from '../mapcreator/tools/select'

const apply = (doc: MapDoc, ch: Parameters<typeof applyChanges>[1]) =>
  applyChanges(doc, ch, 'forward')

const prop = (id: string, x: number, y: number, defId = 'crate'): PlacedProp => ({
  id,
  layer: 'objects',
  defId,
  x,
  y,
  rotation: 0,
  mirrored: false,
})

describe('flood fill', () => {
  it('fills the whole empty map and stays inside its edges', () => {
    const doc = createEmptyMap({ width: 10, height: 6 })
    const next = apply(doc, fillChanges(doc, { x: 3, y: 3 }, 'grass'))
    expect(Object.keys(next.tiles)).toHaveLength(60)
    expect(Object.keys(next.tiles).every((k) => /^\d,\d$/.test(k))).toBe(true)
  })

  it('only replaces contiguous cells of the same tile', () => {
    let doc = createEmptyMap({ width: 10, height: 5 })
    // A vertical stone line at x = 4 splits the map.
    doc = apply(
      doc,
      paintChanges(
        doc,
        [0, 1, 2, 3, 4].map((y) => ({ x: 4, y })),
        'stone-floor',
      ),
    )
    doc = apply(doc, fillChanges(doc, { x: 0, y: 0 }, 'grass'))
    expect(Object.values(doc.tiles).filter((t) => t === 'grass')).toHaveLength(20)
    expect(doc.tiles['5,0']).toBeUndefined()
  })

  it('can be bounded by walls', () => {
    let doc = createEmptyMap({ width: 4, height: 2 })
    for (const y of [0, 1]) doc.walls[edgeKey('v', 2, y)] = { door: false, secret: false }
    expect(floodRegion(doc, { x: 0, y: 0 }, true)).toHaveLength(4)
    expect(floodRegion(doc, { x: 0, y: 0 }, false)).toHaveLength(8)
    doc = apply(doc, fillChanges(doc, { x: 0, y: 0 }, 'dirt', true))
    expect(Object.keys(doc.tiles).sort()).toEqual(['0,0', '0,1', '1,0', '1,1'])
  })

  it('is a no-op when the tile already matches', () => {
    let doc = createEmptyMap({ width: 3, height: 3 })
    doc = apply(doc, fillChanges(doc, { x: 0, y: 0 }, 'grass'))
    expect(fillChanges(doc, { x: 1, y: 1 }, 'grass')).toEqual([])
  })
})

describe('eraser', () => {
  it('erases per layer', () => {
    let doc = createEmptyMap({ width: 5, height: 5 })
    doc = apply(doc, paintChanges(doc, [{ x: 1, y: 1 }], 'grass'))
    doc.walls[edgeKey('h', 1, 1)] = { door: true, secret: false }
    doc.props.a = prop('a', 1, 1)
    expect(eraseChanges(doc, 'terrain', [{ x: 1, y: 1 }])).toHaveLength(1)
    expect(eraseChanges(doc, 'walls', [{ x: 1, y: 1 }])).toHaveLength(1)
    expect(eraseChanges(doc, 'objects', [{ x: 1, y: 1 }])).toHaveLength(1)
    expect(eraseChanges(doc, 'tokens', [{ x: 1, y: 1 }])).toHaveLength(0)
  })
})

describe('selection', () => {
  it('hit-tests multi-cell props by footprint', () => {
    const doc = createEmptyMap({ width: 10, height: 10 })
    doc.props.t = prop('t', 2, 2, 'tree') // 2×2
    expect(hitTest(doc, 'objects', 3.5, 3.5)).toBe('t')
    expect(hitTest(doc, 'objects', 4.5, 3.5)).toBeNull()
    expect(itemsInRect(doc, 'objects', { x: 3, y: 3, w: 1, h: 1 })).toEqual(['t'])
  })

  it('moves terrain cells and clamps to the map', () => {
    let doc = createEmptyMap({ width: 5, height: 5 })
    doc = apply(
      doc,
      paintChanges(
        doc,
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        'grass',
      ),
    )
    const sel = { layer: 'terrain' as const, ids: ['0,0', '1,0'] }
    expect(clampDelta(doc, sel, 10, -3)).toEqual({ dx: 3, dy: 0 })
    const { changes, selection } = transformSelection(doc, sel, 1, 2, false)
    doc = apply(doc, changes)
    expect(Object.keys(doc.tiles).sort()).toEqual(['1,2', '2,2'])
    expect(selection.ids).toEqual(['1,2', '2,2'])
  })

  it('duplicates props with new ids and deletes them', () => {
    let doc = createEmptyMap({ width: 10, height: 10 })
    doc.props.a = prop('a', 1, 1)
    const { changes, selection } = transformSelection(
      doc,
      { layer: 'objects', ids: ['a'] },
      1,
      1,
      true,
    )
    doc = apply(doc, changes)
    expect(Object.keys(doc.props)).toHaveLength(2)
    const copy = doc.props[selection.ids[0]]
    expect(copy).toMatchObject({ x: 2, y: 2, defId: 'crate' })
    doc = apply(doc, deleteSelection(doc, selection))
    expect(Object.keys(doc.props)).toEqual(['a'])
  })

  it('moves wall edges', () => {
    let doc = createEmptyMap({ width: 5, height: 5 })
    doc.walls['h:0,0'] = { door: false, secret: false }
    doc.walls['v:0,0'] = { door: true, secret: false }
    const sel = {
      layer: 'walls' as const,
      ids: itemsInRect(doc, 'walls', { x: 0, y: 0, w: 1, h: 1 }),
    }
    expect(sel.ids.sort()).toEqual(['h:0,0', 'v:0,0'])
    doc = apply(doc, transformSelection(doc, sel, 2, 1, false).changes)
    expect(doc.walls).toEqual({
      'h:2,1': { door: false, secret: false },
      'v:2,1': { door: true, secret: false },
    })
  })

  it('rotates props and keeps them inside the map', () => {
    let doc = createEmptyMap({ width: 5, height: 5 })
    doc.props.t = prop('t', 0, 4, 'table') // 2×1 → 1×2 after rotating
    doc = apply(doc, reorientProps(doc, ['t'], 1, false))
    expect(doc.props.t).toMatchObject({ rotation: 90, x: 0, y: 3 })
    doc = apply(doc, reorientProps(doc, ['t'], -1, true))
    expect(doc.props.t).toMatchObject({ rotation: 0, mirrored: true })
  })

  it('centres stamps on the cursor and validates bounds', () => {
    const doc = createEmptyMap({ width: 5, height: 5 })
    expect(stampAnchor(doc, { w: 2, h: 2 }, 2, 2)).toMatchObject({
      x: 2,
      y: 2,
      w: 2,
      h: 2,
      valid: true,
    })
    expect(stampAnchor(doc, { w: 2, h: 2 }, 4, 4).valid).toBe(false)
  })
})
