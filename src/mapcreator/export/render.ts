// Offscreen rendering of a whole map for export (PNG, PDF). Uses the same
// drawing routines as the editor, at an exact integer cell size.

import { drawNotes, drawProps, drawTiles, drawWalls } from '../canvas/draw'
import type { MapDoc } from '../layers/model'
import { gridLineOffsets, gridLineWidth } from './layout'

export interface RenderOptions {
  cellPx: number
  includeGrid: boolean
  includeWalls: boolean
  includeObjects: boolean
  includeTokens: boolean
  includeNotes: boolean
  /** DM copy: draw secret doors as doors. Player copy: draw them as plain wall. */
  revealSecrets: boolean
  /** CSS colour, or null for a transparent background. */
  background: string | null
  gridColor: string
  gridOpacity: number
}

export function renderMap(doc: MapDoc, o: RenderOptions): HTMLCanvasElement {
  const G = o.cellPx
  const canvas = document.createElement('canvas')
  canvas.width = doc.width * G
  canvas.height = doc.height * G
  const ctx = canvas.getContext('2d')!
  if (o.background) {
    ctx.fillStyle = o.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  // Hidden layers in the editor are left out of the export too.
  const L = doc.layers
  const layer = (visible: boolean, opacity: number, draw: () => void) => {
    if (!visible) return
    ctx.save()
    ctx.globalAlpha = opacity
    draw()
    ctx.restore()
  }
  layer(L.terrain.visible, L.terrain.opacity, () =>
    drawTiles(ctx, doc.tiles, Object.keys(doc.tiles), 0, 0, G),
  )
  if (o.includeWalls)
    layer(L.walls.visible, L.walls.opacity, () =>
      drawWalls(ctx, doc.walls, G, { revealSecrets: o.revealSecrets }),
    )
  const props = Object.values(doc.props)
  if (o.includeObjects)
    layer(L.objects.visible, L.objects.opacity, () =>
      drawProps(
        ctx,
        props.filter((p) => p.layer === 'objects'),
        G,
      ),
    )
  if (o.includeGrid) drawExportGrid(ctx, doc.width, doc.height, G, o.gridColor, o.gridOpacity)
  if (o.includeTokens)
    layer(L.tokens.visible, L.tokens.opacity, () =>
      drawProps(
        ctx,
        props.filter((p) => p.layer === 'tokens'),
        G,
        { showHidden: false },
      ),
    )
  if (o.includeNotes)
    layer(L.notes.visible, L.notes.opacity, () => drawNotes(ctx, Object.values(doc.notes), G))
  return canvas
}

/** Pixel-exact grid: filled rects at multiples of the cell size (see layout.ts). */
export function drawExportGrid(
  ctx: CanvasRenderingContext2D,
  cellsW: number,
  cellsH: number,
  G: number,
  color: string,
  opacity: number,
) {
  const lw = gridLineWidth(G)
  const W = cellsW * G
  const H = cellsH * G
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = color
  for (const x of gridLineOffsets(cellsW, G, lw)) ctx.fillRect(x, 0, lw, H)
  for (const y of gridLineOffsets(cellsH, G, lw)) ctx.fillRect(0, y, W, lw)
  ctx.restore()
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('The browser could not encode the image.'))),
      type,
    ),
  )
}

/** A solid black mask the size of the map: a starting point for VTT fog of war. */
export function fogMask(doc: MapDoc, cellPx: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = doc.width * cellPx
  canvas.height = doc.height * cellPx
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
