// Built-in placeholder catalogue. All art is procedural (see procedural.ts), so
// nothing third-party is bundled. Flags follow common-sense table conventions
// and can be overridden by the DM in custom tilesets.

import type { AssetCategory, AssetDef, AssetKind } from './types'

type Flags = Pick<AssetDef, 'blocksMovement' | 'blocksSight' | 'difficultTerrain'>
const open: Flags = { blocksMovement: false, blocksSight: false, difficultTerrain: false }
const difficult: Flags = { ...open, difficultTerrain: true }
/** Blocks movement and sight (walls of rock, big solid objects). */
const solid: Flags = { blocksMovement: true, blocksSight: true, difficultTerrain: false }
/** Blocks movement but can be seen over. */
const obstacle: Flags = { blocksMovement: true, blocksSight: false, difficultTerrain: false }

interface Spec {
  id: string
  name: string
  kind: AssetKind
  category: AssetCategory
  pattern: string
  colors: string[]
  flags: Flags
  tags: string[]
  w?: number
  h?: number
}

const def = (s: Spec): AssetDef => ({
  id: s.id,
  name: s.name,
  kind: s.kind,
  category: s.category,
  footprint: { w: s.w ?? 1, h: s.h ?? 1 },
  ...s.flags,
  tags: s.tags,
  art: { type: 'procedural', pattern: s.pattern, colors: s.colors },
  source: 'Built-in',
})

const tile = (
  category: AssetCategory,
  id: string,
  name: string,
  pattern: string,
  colors: string[],
  flags: Flags,
  tags: string[],
) => def({ id, name, kind: 'tile', category, pattern, colors, flags, tags })

const prop = (
  category: AssetCategory,
  id: string,
  name: string,
  pattern: string,
  colors: string[],
  flags: Flags,
  tags: string[],
  w = 1,
  h = 1,
) => def({ id, name, kind: 'prop', category, pattern, colors, flags, tags, w, h })

const token = (id: string, name: string, colors: string[], side: AssetDef['tokenSide']) => ({
  ...def({
    id,
    name,
    kind: 'token',
    category: 'tokens',
    pattern: 'token',
    colors,
    flags: open,
    tags: ['token', 'creature', 'marker', side ?? ''],
  }),
  tokenSide: side,
})

export const BUILTIN_ASSETS: AssetDef[] = [
  // Terrain
  tile(
    'terrain',
    'stone-floor',
    'Stone floor',
    'flagstones',
    ['#8a8a85', '#5f5f5a', '#9a9a94'],
    open,
    ['stone', 'floor', 'dungeon'],
  ),
  tile('terrain', 'wood-floor', 'Wood floor', 'planks', ['#9b6b3e', '#5e3d20', '#a8784a'], open, [
    'wood',
    'floor',
    'interior',
  ]),
  tile('terrain', 'dirt', 'Dirt', 'speckle', ['#7a5a3a', '#5e4329', '#8e6c48'], open, [
    'dirt',
    'ground',
    'outdoor',
  ]),
  tile('terrain', 'grass', 'Grass', 'grass', ['#4f7d3a', '#3b6229', '#6a9a4c'], open, [
    'grass',
    'ground',
    'outdoor',
  ]),
  tile('terrain', 'water-shallow', 'Shallow water', 'water', ['#5aa0c8', '#8cc4e0'], difficult, [
    'water',
    'shallow',
    'liquid',
  ]),
  tile('terrain', 'water-deep', 'Deep water', 'water', ['#245d8a', '#3f7cab'], difficult, [
    'water',
    'deep',
    'liquid',
    'swim',
  ]),
  tile('terrain', 'lava', 'Lava', 'lava', ['#7f1d1d', '#f97316', '#fde047'], open, [
    'lava',
    'fire',
    'hazard',
    'liquid',
  ]),
  tile('terrain', 'ice', 'Ice', 'ice', ['#cfe8f3', '#ffffff', '#a5cfe0'], difficult, [
    'ice',
    'cold',
    'slippery',
  ]),
  tile('terrain', 'sand', 'Sand', 'speckle', ['#d8c08a', '#c0a46c', '#e6d3a4'], open, [
    'sand',
    'ground',
    'desert',
  ]),
  tile('terrain', 'rubble', 'Rubble', 'rubble', ['#6d6a64', '#4a4844', '#8d8a82'], difficult, [
    'stone',
    'rubble',
    'debris',
  ]),
  tile('terrain', 'mud', 'Mud', 'mud', ['#4a3a28', '#3a2c1e', '#5d4a33'], difficult, [
    'mud',
    'ground',
    'swamp',
  ]),
  tile('terrain', 'rock', 'Solid rock', 'speckle', ['#3b3734', '#2c2926', '#4a4541'], solid, [
    'stone',
    'rock',
    'wall',
    'cave',
  ]),

  // Dungeon features
  tile('dungeon', 'pit', 'Pit', 'pit', ['#8a8a85', '#111111', '#3f3f3f'], obstacle, [
    'pit',
    'hole',
    'trap',
    'hazard',
  ]),
  tile('dungeon', 'chasm', 'Chasm', 'chasm', ['#0b0b0f', '#1f1f2a'], obstacle, [
    'chasm',
    'drop',
    'hazard',
  ]),
  tile('dungeon', 'bridge', 'Bridge', 'bridge', ['#0b0b0f', '#8b5a2b', '#4f3016'], open, [
    'bridge',
    'wood',
    'crossing',
  ]),
  tile('dungeon', 'stairs-up', 'Stairs up', 'stairsUp', ['#9a968e', '#5b5852', '#ffffff'], open, [
    'stairs',
    'up',
    'exit',
    'stone',
  ]),
  tile(
    'dungeon',
    'stairs-down',
    'Stairs down',
    'stairsDown',
    ['#6b6862', '#3b3934', '#ffffff'],
    open,
    ['stairs', 'down', 'exit', 'stone'],
  ),
  prop(
    'dungeon',
    'altar',
    'Altar',
    'altar',
    ['#b8b2a6', '#6b665c', '#c9a227'],
    obstacle,
    ['altar', 'temple', 'stone', 'religious'],
    2,
    1,
  ),
  prop('dungeon', 'trapdoor', 'Trapdoor', 'trapdoor', ['#6b4426', '#2d1c0f', '#9ca3af'], open, [
    'trapdoor',
    'trap',
    'hatch',
    'secret',
  ]),

  // Props
  prop(
    'props',
    'table',
    'Table',
    'table',
    ['#8b5a2b', '#4f3016'],
    obstacle,
    ['furniture', 'wood', 'tavern'],
    2,
    1,
  ),
  prop('props', 'chair', 'Chair', 'chair', ['#8b5a2b', '#5a3a1c'], open, [
    'furniture',
    'wood',
    'tavern',
  ]),
  prop('props', 'barrel', 'Barrel', 'barrel', ['#7b4f28', '#3d2814'], obstacle, [
    'container',
    'wood',
    'storage',
  ]),
  prop('props', 'crate', 'Crate', 'crate', ['#a37845', '#5c3f1e'], obstacle, [
    'container',
    'wood',
    'storage',
  ]),
  prop(
    'props',
    'bed',
    'Bed',
    'bed',
    ['#6b4426', '#7a2f2f', '#eeeeee'],
    obstacle,
    ['furniture', 'rest', 'inn'],
    1,
    2,
  ),
  prop(
    'props',
    'bookshelf',
    'Bookshelf',
    'bookshelf',
    ['#5e3d20', '#2d1c0f', '#7a2f2f', '#2f5d7a', '#c9a227'],
    obstacle,
    ['furniture', 'books', 'library', 'wood'],
    2,
    1,
  ),
  prop('props', 'pillar', 'Pillar', 'pillar', ['#9a968e', '#5b5852'], solid, [
    'stone',
    'column',
    'dungeon',
  ]),
  prop('props', 'statue', 'Statue', 'statue', ['#b8b2a6', '#6b665c'], obstacle, [
    'stone',
    'statue',
    'decor',
    'temple',
  ]),
  prop('props', 'campfire', 'Campfire', 'campfire', ['#57534e', '#f97316', '#fde047'], open, [
    'fire',
    'camp',
    'light',
    'outdoor',
  ]),
  prop(
    'props',
    'cart',
    'Cart',
    'cart',
    ['#8b5a2b', '#4f3016', '#3f3f46'],
    obstacle,
    ['vehicle', 'wood', 'road', 'town'],
    2,
    1,
  ),
  prop(
    'props',
    'tree',
    'Tree',
    'tree',
    ['#2f6b2a', '#3f8a37', '#255522'],
    solid,
    ['tree', 'plant', 'outdoor', 'forest'],
    2,
    2,
  ),
  prop('props', 'boulder', 'Boulder', 'boulder', ['#78716c', '#57534e', '#a8a29e'], solid, [
    'stone',
    'rock',
    'cover',
    'outdoor',
  ]),
  prop(
    'props',
    'tent',
    'Tent',
    'tent',
    ['#a3a35a', '#6b6b32', '#3f3f20'],
    solid,
    ['camp', 'shelter', 'outdoor', 'cloth'],
    2,
    2,
  ),
  prop('props', 'chest', 'Chest', 'chest', ['#7a4a1f', '#c9a227'], obstacle, [
    'container',
    'treasure',
    'loot',
  ]),

  // Town
  tile('town', 'cobblestone', 'Cobblestone', 'cobble', ['#7c7a75', '#5a5853', '#94918b'], open, [
    'stone',
    'road',
    'street',
    'town',
  ]),
  prop(
    'town',
    'tavern',
    'Tavern',
    'roof',
    ['#7a2f2f', '#4a1c1c', '#c9a227'],
    solid,
    ['building', 'tavern', 'inn', 'roof'],
    4,
    3,
  ),
  prop(
    'town',
    'shop-counter',
    'Shop counter',
    'counter',
    ['#8b5a2b', '#4f3016', '#c9a227'],
    obstacle,
    ['shop', 'counter', 'furniture', 'tavern', 'wood'],
    3,
    1,
  ),
  prop(
    'town',
    'market-stall',
    'Market stall',
    'stall',
    ['#b91c1c', '#fef3c7', '#8b5a2b'],
    obstacle,
    ['market', 'shop', 'awning', 'trade'],
    2,
    2,
  ),
  prop('town', 'well', 'Well', 'well', ['#8a8a85', '#5f5f5a', '#245d8a'], obstacle, [
    'well',
    'water',
    'stone',
    'village',
  ]),
  prop('town', 'fence', 'Fence', 'fence', ['#8b5a2b', '#4f3016'], obstacle, [
    'fence',
    'wood',
    'barrier',
    'farm',
  ]),

  // Tokens
  token('token-pc', 'PC', ['#2563eb', '#dbeafe'], 'pc'),
  token('token-ally', 'Ally', ['#16a34a', '#dcfce7'], 'ally'),
  token('token-monster', 'Monster', ['#dc2626', '#fee2e2'], 'enemy'),
  token('token-npc', 'NPC', ['#ca8a04', '#fef9c3'], 'neutral'),
]
