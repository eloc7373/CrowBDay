import { beforeEach, describe, expect, it } from 'vitest'
import { brushCells, rectCells } from '../lib/geometry'
import { createRng } from '../lib/rng'
import { createEmptyMap, edgeKey, type MapDoc } from '../mapcreator/layers/model'
import { HISTORY_CAP, metaChange, compact, setChange } from '../mapcreator/store/history'
import { useMapStore } from '../mapcreator/store/mapStore'
import { eraseChanges, fillChanges, paintChanges } from '../mapcreator/tools/paint'
import { transformSelection } from '../mapcreator/tools/select'

const store = () => useMapStore.getState()
const clone = (d: MapDoc) => structuredClone(d)

beforeEach(() => {
  store().loadDoc(createEmptyMap({ width: 30, height: 20 }))
})

/** Performs one random edit through the store's public API. */
function randomEdit(i: number, rng: ReturnType<typeof createRng>) {
  const doc = store().doc
  const cell = { x: rng.int(0, doc.width - 1), y: rng.int(0, doc.height - 1) }
  const tiles = ['stone-floor', 'grass', 'water-deep', 'dirt']
  switch (rng.int(0, 8)) {
    case 0: {
      // Brush stroke made of several dabs, coalesced in a transaction.
      store().beginTx('Paint')
      const tile = rng.pick(tiles)
      for (let s = 0; s < 5; s++) {
        const c = { x: cell.x + s, y: cell.y }
        store().txApply(paintChanges(store().doc, brushCells(c.x, c.y, rng.int(1, 3)), tile))
      }
      store().endTx()
      break
    }
    case 1:
      store().commit('Fill', fillChanges(doc, cell, rng.pick(tiles)))
      break
    case 2:
      store().commit('Erase', eraseChanges(doc, 'terrain', brushCells(cell.x, cell.y, 3)))
      break
    case 3:
      store().commit(
        'Wall',
        compact([
          setChange(doc, 'walls', edgeKey('h', cell.x, cell.y), {
            door: rng.chance(0.3),
            secret: false,
          }),
        ]),
      )
      break
    case 4:
      store().commit(
        'Stamp',
        compact([
          setChange(doc, 'props', `p${i}`, {
            id: `p${i}`,
            layer: 'objects',
            defId: 'crate',
            x: cell.x,
            y: cell.y,
            rotation: 0,
            mirrored: false,
          }),
        ]),
      )
      break
    case 5: {
      const ids = Object.keys(doc.props)
      if (ids.length) {
        const { changes } = transformSelection(
          doc,
          { layer: 'objects', ids: [rng.pick(ids)] },
          2,
          -1,
          rng.chance(0.5),
        )
        store().commit('Move', changes)
      }
      break
    }
    case 6:
      store().commit(
        'Note',
        compact([
          setChange(doc, 'notes', `n${i}`, {
            id: `n${i}`,
            kind: 'label',
            x: cell.x,
            y: cell.y,
            text: `Note ${i}`,
          }),
        ]),
      )
      break
    case 7:
      store().commit(
        'Grid',
        compact([metaChange(doc, 'grid', { ...doc.grid, opacity: rng.next() })]),
      )
      break
    case 8:
      store().commit(
        'Rect',
        paintChanges(
          doc,
          rectCells(cell, { x: cell.x + 3, y: cell.y + 2 }, 'outline'),
          rng.pick(tiles),
        ),
      )
      break
  }
}

describe('undo/redo history', () => {
  it('50 random edits, undo all → initial state; redo all → final state', () => {
    const initial = clone(store().doc)
    const rng = createRng('history-test')
    let edits = 0
    for (let i = 0; edits < 50; i++) {
      const before = store().past.length
      randomEdit(i, rng)
      if (store().past.length > before) edits++
    }
    expect(store().past.length).toBe(50)
    const final = clone(store().doc)
    expect(final).not.toEqual(initial)

    while (store().past.length) store().undo()
    expect(store().doc).toEqual(initial)

    while (store().future.length) store().redo()
    expect(store().doc).toEqual(final)
  })

  it('coalesces a continuous stroke into one undo step', () => {
    store().beginTx('Paint')
    for (let x = 0; x < 10; x++) store().txApply(paintChanges(store().doc, [{ x, y: 0 }], 'grass'))
    // Re-painting the same cells in the same stroke stays one step.
    for (let x = 0; x < 10; x++) store().txApply(paintChanges(store().doc, [{ x, y: 0 }], 'dirt'))
    store().endTx()
    expect(store().past).toHaveLength(1)
    expect(Object.keys(store().doc.tiles)).toHaveLength(10)
    store().undo()
    expect(store().doc.tiles).toEqual({})
  })

  it('cancelTx reverts the in-progress stroke without a history entry', () => {
    store().beginTx('Paint')
    store().txApply(paintChanges(store().doc, brushCells(5, 5, 3), 'grass'))
    store().cancelTx()
    expect(store().doc.tiles).toEqual({})
    expect(store().past).toHaveLength(0)
  })

  it('caps history at 200 entries', () => {
    for (let i = 0; i < HISTORY_CAP + 25; i++) {
      store().commit(
        'Paint',
        paintChanges(store().doc, [{ x: i % 30, y: Math.floor(i / 30) }], 'grass'),
      )
    }
    expect(store().past).toHaveLength(HISTORY_CAP)
  })

  it('a new edit clears the redo stack', () => {
    store().commit('Paint', paintChanges(store().doc, [{ x: 0, y: 0 }], 'grass'))
    store().undo()
    expect(store().future).toHaveLength(1)
    store().commit('Paint', paintChanges(store().doc, [{ x: 1, y: 0 }], 'grass'))
    expect(store().future).toHaveLength(0)
  })

  it('no-op edits do not create history entries', () => {
    store().commit('Paint', paintChanges(store().doc, [{ x: 0, y: 0 }], 'grass'))
    store().commit('Paint', paintChanges(store().doc, [{ x: 0, y: 0 }], 'grass'))
    expect(store().past).toHaveLength(1)
  })
})
