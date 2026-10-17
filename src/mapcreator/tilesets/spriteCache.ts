// Renders asset art once per (asset, cell size, variant, autotile mask) and caches
// the canvas, so map drawing is just drawImage calls.

import { mulberry32 } from '../../lib/rng'
import { drawPattern } from './procedural'
import type { AssetDef, Frame } from './types'

/** Visual variants for procedural tiles (picked per cell by a coordinate hash). */
export const TILE_VARIANTS = 4

const cache = new Map<string, HTMLCanvasElement>()
const images = new Map<string, CanvasImageSource>()

export function registerTilesetImage(tilesetId: string, image: CanvasImageSource): void {
  images.set(tilesetId, image)
  cache.clear()
}

export function unregisterTilesetImage(tilesetId: string): void {
  images.delete(tilesetId)
  cache.clear()
}

/** Number of distinct variants an asset has (used to pick one per cell). */
export function variantCount(def: AssetDef): number {
  if (def.kind !== 'tile') return 1
  return def.art.type === 'image' ? Math.max(1, def.art.frames.length) : TILE_VARIANTS
}

function pickFrame(def: AssetDef, variant: number, mask: number | undefined): Frame | null {
  if (def.art.type !== 'image') return null
  if (mask !== undefined && def.autotile?.frames[mask]) return def.autotile.frames[mask]!
  return def.art.frames[variant % def.art.frames.length] ?? null
}

/**
 * @param mask autotile neighbour mask (N=1, E=2, S=4, W=8) for edge-matched tiles.
 */
export function getSprite(
  def: AssetDef,
  cellSize: number,
  variant = 0,
  mask?: number,
): HTMLCanvasElement {
  const v = variant % variantCount(def)
  const m = def.autotile ? mask : undefined
  const key = `${def.id}|${cellSize}|${v}|${m ?? ''}`
  let canvas = cache.get(key)
  if (canvas) return canvas

  canvas = document.createElement('canvas')
  canvas.width = def.footprint.w * cellSize
  canvas.height = def.footprint.h * cellSize
  const ctx = canvas.getContext('2d')!
  if (def.art.type === 'procedural') {
    drawPattern(
      ctx,
      def.art.pattern,
      canvas.width,
      canvas.height,
      mulberry32(v * 7919 + 1),
      def.art.colors,
    )
  } else {
    const image = images.get(def.art.tilesetId)
    const frame = pickFrame(def, v, m)
    if (image && frame) {
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, canvas.width, canvas.height)
    } else {
      drawPattern(ctx, 'missing', canvas.width, canvas.height, Math.random, [])
    }
  }
  cache.set(key, canvas)
  return canvas
}

/** Placeholder definition for ids whose asset is not installed (e.g. a removed tileset). */
export function missingAsset(id: string, footprint = { w: 1, h: 1 }): AssetDef {
  return {
    id: `missing:${id}`,
    name: `Missing: ${id}`,
    kind: 'prop',
    category: 'props',
    footprint,
    blocksMovement: false,
    blocksSight: false,
    difficultTerrain: false,
    tags: [],
    art: { type: 'procedural', pattern: 'missing', colors: [] },
    source: 'Missing',
  }
}
