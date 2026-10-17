import type { Footprint } from '../layers/model'

export type AssetKind = 'tile' | 'prop' | 'token'

export type AssetCategory = 'terrain' | 'dungeon' | 'props' | 'town' | 'tokens'

/** Procedural placeholder art: a named pattern plus a colour palette. */
export interface ProceduralArt {
  pattern: string
  colors: string[]
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
  art: ProceduralArt
}
