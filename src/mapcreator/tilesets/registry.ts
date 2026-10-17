// Built-in placeholder assets. Phase 1 ships a starter set; Phase 2 expands it
// and adds user tilesets loaded from tileset.json + PNG sprite sheets.

import type { AssetDef } from './types'

type Flags = Pick<AssetDef, 'blocksMovement' | 'blocksSight' | 'difficultTerrain'>
const open: Flags = { blocksMovement: false, blocksSight: false, difficultTerrain: false }
const difficult: Flags = { ...open, difficultTerrain: true }
const solid: Flags = { blocksMovement: true, blocksSight: true, difficultTerrain: false }
const obstacle: Flags = { blocksMovement: true, blocksSight: false, difficultTerrain: false }

const tile = (
  id: string,
  name: string,
  pattern: string,
  colors: string[],
  flags: Flags,
  tags: string[],
): AssetDef => ({
  id,
  name,
  kind: 'tile',
  category: 'terrain',
  footprint: { w: 1, h: 1 },
  ...flags,
  tags,
  art: { pattern, colors },
})

const prop = (
  id: string,
  name: string,
  pattern: string,
  colors: string[],
  flags: Flags,
  tags: string[],
  w = 1,
  h = 1,
): AssetDef => ({
  id,
  name,
  kind: 'prop',
  category: 'props',
  footprint: { w, h },
  ...flags,
  tags,
  art: { pattern, colors },
})

const token = (id: string, name: string, colors: string[]): AssetDef => ({
  id,
  name,
  kind: 'token',
  category: 'tokens',
  footprint: { w: 1, h: 1 },
  ...open,
  tags: ['token', 'marker'],
  art: { pattern: 'token', colors },
})

export const BUILTIN_ASSETS: AssetDef[] = [
  tile('stone-floor', 'Stone floor', 'flagstones', ['#8a8a85', '#5f5f5a', '#9a9a94'], open, [
    'stone',
    'floor',
    'dungeon',
  ]),
  tile('wood-floor', 'Wood floor', 'planks', ['#9b6b3e', '#5e3d20', '#a8784a'], open, [
    'wood',
    'floor',
    'interior',
  ]),
  tile('dirt', 'Dirt', 'speckle', ['#7a5a3a', '#5e4329', '#8e6c48'], open, [
    'dirt',
    'ground',
    'outdoor',
  ]),
  tile('grass', 'Grass', 'grass', ['#4f7d3a', '#3b6229', '#6a9a4c'], open, [
    'grass',
    'ground',
    'outdoor',
  ]),
  tile('water-shallow', 'Shallow water', 'water', ['#5aa0c8', '#8cc4e0'], difficult, [
    'water',
    'shallow',
    'liquid',
  ]),
  tile('water-deep', 'Deep water', 'water', ['#245d8a', '#3f7cab'], difficult, [
    'water',
    'deep',
    'liquid',
    'swim',
  ]),
  tile('sand', 'Sand', 'speckle', ['#d8c08a', '#c0a46c', '#e6d3a4'], open, [
    'sand',
    'ground',
    'desert',
  ]),
  tile('rubble', 'Rubble', 'speckle', ['#6d6a64', '#4a4844', '#8d8a82'], difficult, [
    'stone',
    'rubble',
    'debris',
  ]),
  tile('rock', 'Solid rock', 'speckle', ['#3b3734', '#2c2926', '#4a4541'], solid, [
    'stone',
    'rock',
    'wall',
  ]),

  prop(
    'table',
    'Table',
    'table',
    ['#8b5a2b', '#4f3016'],
    obstacle,
    ['furniture', 'wood', 'tavern'],
    2,
    1,
  ),
  prop('chair', 'Chair', 'chair', ['#8b5a2b', '#5a3a1c'], open, ['furniture', 'wood', 'tavern']),
  prop('barrel', 'Barrel', 'barrel', ['#7b4f28', '#3d2814'], obstacle, [
    'container',
    'wood',
    'storage',
  ]),
  prop('crate', 'Crate', 'crate', ['#a37845', '#5c3f1e'], obstacle, [
    'container',
    'wood',
    'storage',
  ]),
  prop(
    'bed',
    'Bed',
    'bed',
    ['#6b4426', '#7a2f2f', '#eeeeee'],
    obstacle,
    ['furniture', 'rest', 'inn'],
    1,
    2,
  ),
  prop('pillar', 'Pillar', 'pillar', ['#9a968e', '#5b5852'], solid, ['stone', 'column', 'dungeon']),
  prop('chest', 'Chest', 'chest', ['#7a4a1f', '#c9a227'], obstacle, [
    'container',
    'treasure',
    'loot',
  ]),
  prop(
    'tree',
    'Tree',
    'tree',
    ['#2f6b2a', '#3f8a37', '#255522'],
    solid,
    ['tree', 'plant', 'outdoor'],
    2,
    2,
  ),

  token('token-pc', 'PC token', ['#2563eb', '#dbeafe']),
  token('token-monster', 'Monster token', ['#dc2626', '#fee2e2']),
  token('token-npc', 'NPC token', ['#ca8a04', '#fef9c3']),
]

const byId = new Map(BUILTIN_ASSETS.map((a) => [a.id, a]))

export function getAsset(id: string): AssetDef | undefined {
  return byId.get(id)
}

export function allAssets(): AssetDef[] {
  return [...byId.values()]
}
