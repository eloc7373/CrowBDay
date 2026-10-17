// Renders asset art once per (asset, variant, cell size) and caches the canvas,
// so map drawing is just drawImage calls.

import { mulberry32 } from '../../lib/rng'
import { drawPattern } from './procedural'
import type { AssetDef } from './types'

export const TILE_VARIANTS = 4

const cache = new Map<string, HTMLCanvasElement>()

export function getSprite(def: AssetDef, cellSize: number, variant = 0): HTMLCanvasElement {
  const v = def.kind === 'tile' ? variant % TILE_VARIANTS : 0
  const key = `${def.id}|${cellSize}|${v}`
  let canvas = cache.get(key)
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = def.footprint.w * cellSize
    canvas.height = def.footprint.h * cellSize
    const ctx = canvas.getContext('2d')!
    drawPattern(
      ctx,
      def.art.pattern,
      canvas.width,
      canvas.height,
      mulberry32(v * 7919 + 1),
      def.art.colors,
    )
    cache.set(key, canvas)
  }
  return canvas
}
