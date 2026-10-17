import { describe, expect, it } from 'vitest'
import { generationChanges, runGenerator } from '../mapcreator/generation'
import { mergeWallSegments, toFoundryScene } from '../mapcreator/export/foundry'
import {
  fitToPage,
  fitsCanvas,
  gridLineOffsets,
  gridLineWidth,
  niceScaleFeet,
  PAPERS,
  pngLayout,
} from '../mapcreator/export/layout'
import {
  fromPackage,
  MAP_VERSION,
  migratePackage,
  PackageError,
  parsePackage,
  toPackage,
} from '../mapcreator/export/mapPackage'
import { createEmptyMap, defaultTokenInfo, type MapDoc } from '../mapcreator/layers/model'
import { applyChanges } from '../mapcreator/store/history'
import { withAssetMeta } from '../mapcreator/store/mapStore'

describe('PNG layout (grid-aligned)', () => {
  it('a 30×20 map at 70 px is exactly 2100×1400 at 1× and 4200×2800 at 2×', () => {
    expect(pngLayout('Untitled map', 30, 20, { cellPx: 70, scale: 1 })).toEqual({
      cellPx: 70,
      width: 2100,
      height: 1400,
      filename: 'untitled-map_30x20_70px.png',
    })
    expect(pngLayout('Crypt of the Lich!', 30, 20, { cellPx: 70, scale: 2 })).toMatchObject({
      cellPx: 140,
      width: 4200,
      height: 2800,
      filename: 'crypt-of-the-lich_30x20_140px.png',
    })
    // Cell size is always a whole number of pixels.
    expect(pngLayout('m', 10, 10, { cellPx: 33, scale: 1.5 }).cellPx).toBe(50)
  })

  it('grid lines fall on multiples of the cell size', () => {
    const lw = gridLineWidth(70)
    const xs = gridLineOffsets(30, 70, lw)
    expect(xs).toHaveLength(31)
    for (let i = 0; i < 30; i++) expect(xs[i]).toBe(i * 70)
    // Closing line is flush with the right edge, inside the image.
    expect(xs[30]).toBe(2100 - lw)
    expect(gridLineWidth(140)).toBe(2)
  })

  it('knows browser canvas limits', () => {
    expect(fitsCanvas(2100, 1400)).toBe(true)
    expect(fitsCanvas(200 * 140, 10)).toBe(false)
  })
})

describe('PDF layout', () => {
  it('fits the map inside the margins and picks the better orientation', () => {
    const wide = fitToPage(40, 20, PAPERS.letter, 10, 16)
    expect(wide.orientation).toBe('landscape')
    expect(wide.x + wide.w).toBeLessThanOrEqual(wide.pageW - 10 + 1e-9)
    expect(wide.y + wide.h).toBeLessThanOrEqual(wide.pageH - 10 - 16 + 1e-9)
    expect(wide.w / wide.h).toBeCloseTo(2)
    expect(fitToPage(20, 40, PAPERS.a4, 10, 16).orientation).toBe('portrait')
  })

  it('picks round scale-bar lengths that are whole squares', () => {
    expect(niceScaleFeet(37, 5)).toBe(30)
    expect(niceScaleFeet(120, 5)).toBe(100)
    expect(niceScaleFeet(3, 5)).toBe(5)
    expect(niceScaleFeet(70, 10)).toBe(60)
  })
})

function richMap(): MapDoc {
  let doc = createEmptyMap({ name: 'Round Trip', width: 30, height: 25 })
  doc = applyChanges(
    doc,
    withAssetMeta(
      doc,
      generationChanges(doc, runGenerator('dungeon', { width: 30, height: 25 }, 'rt'), 'replace'),
    ),
    'forward',
  )
  doc = applyChanges(
    doc,
    withAssetMeta(doc, [
      {
        coll: 'props',
        key: 'tok1',
        after: {
          id: 'tok1',
          layer: 'tokens',
          defId: 'token-monster',
          x: 2,
          y: 2,
          rotation: 0,
          mirrored: false,
          token: {
            ...defaultTokenInfo('Ogre', 'enemy'),
            size: 'large',
            hp: { current: 30, max: 59, temp: 2 },
            conditions: ['prone'],
          },
        },
      },
    ]),
    'forward',
  )
  doc.layers.notes = { visible: false, locked: true, opacity: 0.5 }
  doc.grid = { ...doc.grid, color: '#ff0000', opacity: 0.6 }
  return doc
}

describe('map package (JSON)', () => {
  it('round-trips: export → JSON text → import gives an identical map', () => {
    const doc = richMap()
    const pkg = toPackage(doc, '2026-10-17T12:00:00.000Z')
    expect(pkg).toMatchObject({ format: 'dmtk-map', version: MAP_VERSION })
    const text = JSON.stringify(pkg, null, 2)
    const back = parsePackage(text)
    expect(back).toEqual({ ...doc, updatedAt: '2026-10-17T12:00:00.000Z' })
    expect(back).toEqual(fromPackage(pkg))
    // Movement/sight flags travel with the file.
    expect(back.assets.rock).toMatchObject({ blocksMovement: true, blocksSight: true })
  })

  const base = () => JSON.parse(JSON.stringify(toPackage(createEmptyMap({ width: 5, height: 5 }))))
  const errorsFor = (pkg: unknown) => {
    try {
      parsePackage(JSON.stringify(pkg))
      return []
    } catch (e) {
      expect(e).toBeInstanceOf(PackageError)
      return (e as PackageError).errors
    }
  }

  it('reports clear validation errors', () => {
    expect(errorsFor({ ...base(), format: 'something-else' })[0]).toMatch(
      /not a DM Toolkit map file/,
    )
    const p = base()
    delete p.grid
    p.props.x = {
      id: 'x',
      layer: 'objects',
      defId: 'crate',
      x: 0,
      y: 0,
      rotation: 45,
      mirrored: false,
    }
    p.tiles['1;1'] = 'grass'
    p.extra = true
    const errs = errorsFor(p)
    expect(errs).toContain('grid: is required.')
    expect(errs).toContain('props.x.rotation: must be one of 0, 90, 180, 270.')
    expect(errs).toContain('(root): unknown field "extra".')
    expect(errs.some((e) => e.startsWith('tiles: has a key with the wrong format'))).toBe(true)
    expect(() => parsePackage('{ not json')).toThrow(/not valid JSON/)
  })

  it('checks bounds and ids beyond the schema', () => {
    const p = base()
    p.tiles['9,9'] = 'grass'
    p.walls['h:0,9'] = { door: false, secret: false }
    p.props.a = {
      id: 'b',
      layer: 'objects',
      defId: 'crate',
      x: 4,
      y: 4,
      rotation: 0,
      mirrored: false,
    }
    p.props.t = {
      id: 't',
      layer: 'objects',
      defId: 'tree',
      x: 4,
      y: 4,
      rotation: 0,
      mirrored: false,
    }
    const errs = errorsFor(p)
    expect(errs).toContain('tiles["9,9"]: outside the 5×5 map.')
    expect(errs).toContain('walls["h:0,9"]: outside the 5×5 map.')
    expect(errs).toContain('props["a"].id: must match its key (found "b").')
    expect(errs).toContain('props["t"]: extends outside the 5×5 map.')
  })

  it('migration: current version passes, newer versions are refused, missing assets are added', () => {
    const p = base()
    expect(migratePackage(p)).toEqual(p)
    expect(() => migratePackage({ ...p, version: MAP_VERSION + 1 })).toThrow(
      /newer version of DM Toolkit/,
    )
    expect(() => migratePackage({ ...p, version: 0 })).toThrow(/version/)
    const old = { ...p }
    delete old.assets
    expect(parsePackage(JSON.stringify(old)).assets).toEqual({})
  })
})

describe('Foundry scene (experimental)', () => {
  it('merges collinear wall edges and keeps doors separate', () => {
    const runs = mergeWallSegments({
      'h:0,0': { door: false, secret: false },
      'h:1,0': { door: false, secret: false },
      'h:2,0': { door: true, secret: false },
      'h:3,0': { door: false, secret: false },
      'v:5,1': { door: true, secret: true },
    })
    expect(runs).toEqual(
      expect.arrayContaining([
        { o: 'h', fixed: 0, start: 0, end: 2, type: 0 },
        { o: 'h', fixed: 0, start: 2, end: 3, type: 1 },
        { o: 'h', fixed: 0, start: 3, end: 4, type: 0 },
        { o: 'v', fixed: 5, start: 1, end: 2, type: 2 },
      ]),
    )
    expect(runs).toHaveLength(4)
  })

  it('converts to pixel coordinates at the export cell size', () => {
    const doc = createEmptyMap({ width: 10, height: 8 })
    doc.walls['v:3,2'] = { door: true, secret: false }
    const scene = toFoundryScene(doc, 70, 'map.png')
    expect(scene).toMatchObject({
      width: 700,
      height: 560,
      padding: 0,
      grid: { size: 70, distance: 5, type: 1 },
    })
    expect(scene.walls).toEqual([
      { c: [210, 140, 210, 210], door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20 },
    ])
  })
})
