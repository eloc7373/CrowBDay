import { beforeEach, describe, expect, it } from 'vitest'
import { tokenInitials } from '../mapcreator/canvas/draw'
import {
  createEmptyMap,
  defaultTokenInfo,
  type CreatureSize,
  type PlacedProp,
} from '../mapcreator/layers/model'
import { useMapStore } from '../mapcreator/store/mapStore'
import { normalizeDoc } from '../mapcreator/store/persistence'
import { BUILTIN_ASSETS } from '../mapcreator/tilesets/builtinAssets'
import {
  getAsset,
  registerTileset,
  unregisterTileset,
  useAssetStore,
} from '../mapcreator/tilesets/registry'
import { searchAssets, topTags } from '../mapcreator/tilesets/search'
import { edgeMask, parseTileset, slugify } from '../mapcreator/tilesets/tilesetFormat'
import { ASSET_CATEGORIES } from '../mapcreator/tilesets/types'
import { paintChanges, propRect } from '../mapcreator/tools/paint'

describe('built-in catalogue', () => {
  it('populates every category with the assets the spec requires', () => {
    const ids = new Set(BUILTIN_ASSETS.map((a) => a.id))
    const required = [
      // terrain
      'stone-floor',
      'wood-floor',
      'dirt',
      'grass',
      'water-deep',
      'water-shallow',
      'lava',
      'ice',
      'sand',
      'rubble',
      'mud',
      // dungeon features
      'pit',
      'chasm',
      'bridge',
      'stairs-up',
      'stairs-down',
      'altar',
      'trapdoor',
      // props
      'table',
      'chair',
      'barrel',
      'crate',
      'bed',
      'bookshelf',
      'pillar',
      'statue',
      'campfire',
      'cart',
      'well',
      'tree',
      'boulder',
      'tent',
      'chest',
      // town
      'tavern',
      'shop-counter',
      'market-stall',
      'cobblestone',
      'fence',
    ]
    for (const id of required) expect(ids, id).toContain(id)
    for (const c of ASSET_CATEGORIES)
      expect(
        BUILTIN_ASSETS.some((a) => a.category === c),
        c,
      ).toBe(true)
    expect(getAsset('tree')!.footprint).toEqual({ w: 2, h: 2 })
  })

  it('every asset has the required fields and unique ids', () => {
    expect(new Set(BUILTIN_ASSETS.map((a) => a.id)).size).toBe(BUILTIN_ASSETS.length)
    for (const a of BUILTIN_ASSETS) {
      expect(typeof a.blocksMovement).toBe('boolean')
      expect(typeof a.blocksSight).toBe('boolean')
      expect(typeof a.difficultTerrain).toBe('boolean')
      expect(a.tags.length).toBeGreaterThan(0)
      if (a.kind === 'tile') expect(a.footprint).toEqual({ w: 1, h: 1 })
    }
  })
})

describe('asset search', () => {
  it('"stone" returns the stone floor first and related tiles', () => {
    const r = searchAssets(BUILTIN_ASSETS, { query: 'stone' }).map((a) => a.id)
    expect(r[0]).toBe('stone-floor')
    for (const id of ['rubble', 'rock', 'pillar', 'cobblestone', 'statue']) expect(r).toContain(id)
    expect(r).not.toContain('grass')
  })

  it('combines words, categories and tags', () => {
    expect(searchAssets(BUILTIN_ASSETS, { query: 'deep water' }).map((a) => a.id)).toEqual([
      'water-deep',
    ])
    const town = searchAssets(BUILTIN_ASSETS, { category: 'town' })
    expect(town.every((a) => a.category === 'town')).toBe(true)
    const containers = searchAssets(BUILTIN_ASSETS, { tags: ['container'] })
      .map((a) => a.id)
      .sort()
    expect(containers).toEqual(['barrel', 'chest', 'crate'])
    expect(searchAssets(BUILTIN_ASSETS, { query: 'zzz' })).toEqual([])
    expect(topTags(BUILTIN_ASSETS, 3)).toHaveLength(3)
  })
})

describe('tileset.json parsing', () => {
  const base = { name: 'My Dungeon', tileSize: 32, columns: 4, rows: 2 }

  it('parses named tiles, variants, multi-cell props and flags', () => {
    const r = parseTileset(
      {
        ...base,
        license: 'CC0-1.0',
        tiles: [
          { id: 'floor', name: 'Floor', index: 0, variants: [1], tags: ['Stone'] },
          { id: 'wall', index: 2, blocksMovement: true, blocksSight: true },
          { id: 'table', kind: 'prop', col: 0, row: 1, footprint: [2, 1] },
        ],
      },
      { imageWidth: 128, imageHeight: 64 },
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [floor, wall, table] = r.tileset.assets
    expect(r.tileset.id).toBe('my-dungeon')
    expect(floor).toMatchObject({
      id: 'my-dungeon:floor',
      kind: 'tile',
      category: 'terrain',
      tags: ['stone'],
      license: 'CC0-1.0',
    })
    expect(floor.art).toEqual({
      type: 'image',
      tilesetId: 'my-dungeon',
      frames: [
        { x: 0, y: 0, w: 32, h: 32 },
        { x: 32, y: 0, w: 32, h: 32 },
      ],
    })
    expect(wall).toMatchObject({ name: 'wall', blocksMovement: true, blocksSight: true })
    expect(table).toMatchObject({ kind: 'prop', category: 'props', footprint: { w: 2, h: 1 } })
    expect(table.art.type === 'image' && table.art.frames[0]).toEqual({ x: 0, y: 32, w: 64, h: 32 })
  })

  it('honours margin and spacing and derives columns/rows from the image', () => {
    const r = parseTileset(
      { name: 'Spaced', tileSize: 16, margin: 1, spacing: 2 },
      { imageWidth: 1 + 16 * 3 + 2 * 2 + 1, imageHeight: 18 },
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.tileset.columns).toBe(3)
    expect(r.tileset.rows).toBe(1)
    // tiles omitted → every cell imported
    expect(r.tileset.assets.map((a) => a.art.type === 'image' && a.art.frames[0].x)).toEqual([
      1, 19, 37,
    ])
  })

  it('skips empty cells when auto-slicing and applies defaults', () => {
    const r = parseTileset(
      { ...base, defaults: { kind: 'token', category: 'tokens' } },
      { isFrameEmpty: (f) => f.x >= 64 },
    )
    expect(r.ok && r.tileset.assets.length).toBe(4)
    expect(r.ok && r.tileset.assets[0].kind).toBe('token')
  })

  it('reports clear errors', () => {
    const r = parseTileset({
      name: '',
      tileSize: 32,
      columns: 4,
      rows: 2,
      tiles: [
        { id: 'a', index: 8 },
        { id: 'a', index: 0 },
        { id: 'big', kind: 'prop', index: 3, footprint: [2, 1] },
        { id: 'bad id!', index: 0 },
        { id: 'k', index: 0, kind: 'monster' },
      ],
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    const text = r.errors.join('\n')
    expect(text).toContain('name: required')
    expect(text).toContain(
      'tiles[0].index: 8 is outside the sheet (4 columns × 2 rows = 8 tiles, indices 0–7)',
    )
    expect(text).toContain('tiles[1].id: "a" is used more than once')
    expect(text).toContain(
      'tiles[2].index: a 2×1 footprint starting at column 3, row 0 runs off the sheet',
    )
    expect(text).toContain('tiles[3].id: required; letters, digits')
    expect(text).toContain('tiles[4].kind: must be one of tile, prop, token')
  })

  it('rejects grids larger than the image and non-objects', () => {
    const r = parseTileset(base, { imageWidth: 100, imageHeight: 64 })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors[0]).toMatch(/larger than the image \(100×64 px\)/)
    expect(parseTileset([]).ok).toBe(false)
    expect(parseTileset({ name: 'x' }).ok).toBe(false)
    expect(slugify('  Fancy Tiles! v2 ')).toBe('fancy-tiles-v2')
  })

  it('builds edge4 autotile rules and computes neighbour masks', () => {
    const r = parseTileset({
      ...base,
      tiles: [
        { id: 'water', index: 0 },
        { id: 'deep', index: 1 },
      ],
      autotile: [{ tile: 'water', matches: ['deep'], masks: { '0': 4, '15': 5, '5': 6 } }],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const water = r.tileset.assets[0]
    expect(water.autotile?.matches).toEqual(['my-dungeon:water', 'my-dungeon:deep'])
    expect(water.autotile?.frames[15]).toEqual({ x: 32, y: 32, w: 32, h: 32 })
    const tiles = {
      '1,1': 'my-dungeon:water',
      '1,0': 'my-dungeon:deep',
      '1,2': 'my-dungeon:water',
      '2,1': 'grass',
    }
    expect(edgeMask(tiles, 1, 1, water.autotile!.matches)).toBe(1 | 4)
    expect(edgeMask(tiles, 5, 5, water.autotile!.matches)).toBe(0)

    const bad = parseTileset({
      ...base,
      tiles: [{ id: 'w', index: 0 }],
      autotile: [{ tile: 'nope', masks: { '16': 0 } }],
    })
    expect(!bad.ok && bad.errors[0]).toContain('autotile[0].tile: "nope" is not a tile id')
  })
})

describe('registry with user tilesets', () => {
  it('registers, replaces and removes tileset assets', () => {
    const r = parseTileset({ name: 'Reg Test', tileSize: 8, columns: 2, rows: 1 })
    if (!r.ok) throw new Error('parse failed')
    const before = useAssetStore.getState()
    registerTileset(
      { id: r.tileset.id, name: 'Reg Test', assetIds: r.tileset.assets.map((a) => a.id) },
      r.tileset.assets,
    )
    expect(getAsset('reg-test:t0')).toBeDefined()
    expect(useAssetStore.getState().assets).toHaveLength(before.assets.length + 2)
    // Re-registering replaces rather than duplicates.
    registerTileset(
      { id: r.tileset.id, name: 'Reg Test', assetIds: r.tileset.assets.map((a) => a.id) },
      r.tileset.assets,
    )
    expect(useAssetStore.getState().assets).toHaveLength(before.assets.length + 2)
    unregisterTileset(r.tileset.id)
    expect(getAsset('reg-test:t0')).toBeUndefined()
    expect(useAssetStore.getState().assets).toHaveLength(before.assets.length)
    expect(useAssetStore.getState().version).toBeGreaterThan(before.version)
  })
})

describe('asset metadata stored in the map', () => {
  beforeEach(() => useMapStore.getState().loadDoc(createEmptyMap({ width: 10, height: 10 })))

  it('records flags for used assets in the same undo step', () => {
    const s = useMapStore.getState
    s().commit('Paint', paintChanges(s().doc, [{ x: 1, y: 1 }], 'water-deep'))
    expect(s().doc.assets['water-deep']).toMatchObject({
      name: 'Deep water',
      difficultTerrain: true,
      blocksMovement: false,
    })
    expect(s().past).toHaveLength(1)
    // Using it again adds nothing new.
    s().commit('Paint', paintChanges(s().doc, [{ x: 2, y: 1 }], 'water-deep'))
    expect(s().past[1].changes.some((c) => c.coll === 'assets')).toBe(false)
    s().undo()
    s().undo()
    expect(s().doc.assets).toEqual({})
  })

  it('back-fills metadata for maps saved before the field existed', () => {
    const doc = createEmptyMap()
    doc.tiles['0,0'] = 'lava'
    doc.props.p = {
      id: 'p',
      layer: 'objects',
      defId: 'barrel',
      x: 1,
      y: 1,
      rotation: 0,
      mirrored: false,
    }
    const old = { ...doc } as Partial<typeof doc>
    delete old.assets
    const fixed = normalizeDoc(old as typeof doc)
    expect(Object.keys(fixed.assets).sort()).toEqual(['barrel', 'lava'])
  })
})

describe('tokens', () => {
  const token = (size: CreatureSize): PlacedProp => ({
    id: 't',
    layer: 'tokens',
    defId: 'token-monster',
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    token: { ...defaultTokenInfo('Ogre', 'enemy'), size },
  })

  it('sizes the footprint by creature size', () => {
    expect(propRect(token('medium'))).toMatchObject({ w: 1, h: 1 })
    expect(propRect(token('large'))).toMatchObject({ w: 2, h: 2 })
    expect(propRect(token('huge'))).toMatchObject({ w: 3, h: 3 })
    expect(propRect(token('gargantuan'))).toMatchObject({ w: 4, h: 4 })
    expect(propRect(token('tiny'))).toMatchObject({ w: 1, h: 1 })
  })

  it('makes short initials', () => {
    expect(tokenInitials('Goblin Boss')).toBe('GB')
    expect(tokenInitials('Monster 3')).toBe('M3')
    expect(tokenInitials('Ogre')).toBe('OG')
    expect(tokenInitials('  ')).toBe('?')
  })
})
