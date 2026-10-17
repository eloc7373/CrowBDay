// Grid and map boundary drawn in *screen* space so lines stay 1 device pixel
// crisp at every zoom level instead of being scaled with the world.

import type { GridSettings } from '../layers/model'
import type { View } from '../store/editorStore'

export function drawScreenGrid(
  ctx: CanvasRenderingContext2D,
  view: View,
  mapW: number,
  mapH: number,
  grid: GridSettings,
  screenW: number,
  screenH: number,
  dpr: number,
  boundaryColor: string,
) {
  const step = grid.cellSize * view.scale
  const left = view.x
  const top = view.y
  const right = view.x + mapW * step
  const bottom = view.y + mapH * step

  // Snap a CSS coordinate to the centre of a device pixel for an odd-width line.
  const devLine = Math.max(1, Math.round(dpr))
  const lw = devLine / dpr
  const snap = (v: number) => (Math.round(v * dpr) + (devLine % 2 ? 0.5 : 0)) / dpr

  if (grid.visible && step >= 4) {
    // Fade the grid out as cells get tiny so it does not turn into a solid sheet.
    const fade = Math.min(1, (step - 4) / 12)
    ctx.save()
    ctx.globalAlpha = grid.opacity * fade
    ctx.strokeStyle = grid.color
    ctx.lineWidth = lw
    ctx.beginPath()
    const c0 = Math.max(0, Math.ceil(-left / step))
    const c1 = Math.min(mapW, Math.floor((screenW - left) / step))
    for (let c = c0; c <= c1; c++) {
      const x = snap(left + c * step)
      ctx.moveTo(x, Math.max(0, top))
      ctx.lineTo(x, Math.min(screenH, bottom))
    }
    const r0 = Math.max(0, Math.ceil(-top / step))
    const r1 = Math.min(mapH, Math.floor((screenH - top) / step))
    for (let r = r0; r <= r1; r++) {
      const y = snap(top + r * step)
      ctx.moveTo(Math.max(0, left), y)
      ctx.lineTo(Math.min(screenW, right), y)
    }
    ctx.stroke()
    ctx.restore()
  }

  // Map boundary: always drawn, 2 CSS px, just outside the map.
  ctx.save()
  ctx.strokeStyle = boundaryColor
  ctx.lineWidth = 2
  ctx.strokeRect(
    Math.round(left) - 1,
    Math.round(top) - 1,
    Math.round(right - left) + 2,
    Math.round(bottom - top) + 2,
  )
  ctx.restore()
}
