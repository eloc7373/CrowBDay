import type { Footprint, TokenSide } from '../layers/model'

export type AssetKind = 'tile' | 'prop' | 'token'

export const ASSET_CATEGORIES = ['terrain', 'dungeon', 'props', 'town', 'tokens'] as const
export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  terrain: 'Terrain',
  dungeon: 'Dungeon',
  props: 'Props',
  town: 'Town',
  tokens: 'Tokens',
}

/** Pixel rectangle inside a sprite sheet. */
export interface Frame {
  x: number
  y: number
  w: number
  h: number
}

/** Procedural placeholder art: a named pattern plus a colour palette. */
export interface ProceduralArt {
  type: 'procedural'
  pattern: string
  colors: string[]
}

/** Art cut from a user-supplied sprite sheet; one frame per visual variant. */
export interface ImageArt {
  type: 'image'
  tilesetId: string
  frames: Frame[]
}

export type AssetArt = ProceduralArt | ImageArt

/**
 * Edge-matching: the frame is picked by which of the 4 neighbours "match".
 * Mask bits: N = 1, E = 2, S = 4, W = 8 (0–15). Missing masks fall back to the base art.
 */
export interface AutotileRule {
  mode: 'edge4'
  /** Asset ids that count as the same terrain (always includes the asset itself). */
  matches: string[]
  frames: Partial<Record<number, Frame>>
}

export interface AssetDef {
  id: string
  name: string
  kind: AssetKind
  category: AssetCategory
  /** Default footprint in cells (before rotation). Tiles are always 1×1. */
  footprint: Footprint
  blocksMovement: boolean
  blocksSight: boolean
  difficultTerrain: boolean
  tags: string[]
  art: AssetArt
  autotile?: AutotileRule
  /** "Built-in" or the name of the tileset it came from. */
  source: string
  license?: string
  /** Default allegiance for token assets. */
  tokenSide?: TokenSide
}
