// Asset registry: built-in placeholder assets plus any user tilesets loaded at
// runtime. Components subscribe to `useAssetStore` to re-render when it changes.

import { create } from 'zustand'
import type { AssetMeta } from '../layers/model'
import { BUILTIN_ASSETS } from './builtinAssets'
import type { AssetDef } from './types'

export interface InstalledTileset {
  id: string
  name: string
  assetIds: string[]
  license?: string
  author?: string
}

interface AssetState {
  assets: AssetDef[]
  tilesets: InstalledTileset[]
  /** Bumped whenever art may have changed, so cached renders can be invalidated. */
  version: number
}

const byId = new Map(BUILTIN_ASSETS.map((a) => [a.id, a]))

export const useAssetStore = create<AssetState>()(() => ({
  assets: [...BUILTIN_ASSETS],
  tilesets: [],
  version: 0,
}))

export function getAsset(id: string): AssetDef | undefined {
  return byId.get(id)
}

export function allAssets(): AssetDef[] {
  return useAssetStore.getState().assets
}

/** Adds (or replaces) a tileset's assets. */
export function registerTileset(ts: InstalledTileset, defs: AssetDef[]): void {
  unregisterTileset(ts.id, false)
  for (const d of defs) byId.set(d.id, d)
  const s = useAssetStore.getState()
  useAssetStore.setState({
    assets: [...s.assets, ...defs],
    tilesets: [...s.tilesets, ts],
    version: s.version + 1,
  })
}

export function unregisterTileset(id: string, bump = true): void {
  const s = useAssetStore.getState()
  const ts = s.tilesets.find((t) => t.id === id)
  if (!ts) return
  const ids = new Set(ts.assetIds)
  for (const a of ids) byId.delete(a)
  useAssetStore.setState({
    assets: s.assets.filter((a) => !ids.has(a.id)),
    tilesets: s.tilesets.filter((t) => t.id !== id),
    version: bump ? s.version + 1 : s.version,
  })
}

/** The subset of a definition that is copied into maps (see MapDoc.assets). */
export function assetMeta(def: AssetDef): AssetMeta {
  return {
    name: def.name,
    kind: def.kind,
    category: def.category,
    footprint: { ...def.footprint },
    blocksMovement: def.blocksMovement,
    blocksSight: def.blocksSight,
    difficultTerrain: def.difficultTerrain,
    tags: [...def.tags],
    source: def.source,
  }
}
