import { clamp } from '../../lib/geometry'
import type { View } from '../store/editorStore'

export const MIN_SCALE = 0.05
export const MAX_SCALE = 8

export const screenToWorld = (v: View, sx: number, sy: number) => ({
  x: (sx - v.x) / v.scale,
  y: (sy - v.y) / v.scale,
})

/** Zooms by `factor` keeping the world point under screen point (sx, sy) fixed. */
export function zoomAt(v: View, sx: number, sy: number, factor: number): View {
  const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
  const k = scale / v.scale
  return { scale, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k }
}

/** View that fits a world-space rectangle (0,0,w,h) into the screen with padding. */
export function fitView(
  worldW: number,
  worldH: number,
  screenW: number,
  screenH: number,
  pad = 32,
): View {
  const scale = clamp(
    Math.min((screenW - pad * 2) / worldW, (screenH - pad * 2) / worldH),
    MIN_SCALE,
    MAX_SCALE,
  )
  return { scale, x: (screenW - worldW * scale) / 2, y: (screenH - worldH * scale) / 2 }
}

/**
 * Heuristic: mouse wheels report large, purely vertical steps (or line/page
 * deltaMode); trackpads report small, fractional or two-axis deltas.
 */
export function isMouseWheel(e: WheelEvent): boolean {
  if (e.deltaMode !== 0) return true
  return e.deltaX === 0 && Math.abs(e.deltaY) >= 50
}
