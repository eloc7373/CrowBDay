// Plain Canvas 2D drawing routines in world pixels (1 cell = `cell` px).
// Used by the Konva editor shapes and, later, by the offscreen PNG export.

import { parseCellKey } from '../../lib/geometry'
import { hashCoords } from '../../lib/rng'
import {
  parseEdgeKey,
  rotatedFootprint,
  type MapNote,
  type PlacedProp,
  type WallEdge,
} from '../layers/model'
import { getAsset } from '../tilesets/registry'
import { getSprite, TILE_VARIANTS } from '../tilesets/spriteCache'

type Ctx = CanvasRenderingContext2D

export const CHUNK_CELLS = 16

/** Cap on total terrain chunk pixels (~128 MB of RGBA) for very large maps. */
const MAX_TERRAIN_PIXELS = 32_000_000

/** Pixels per cell inside chunk canvases; reduced only for huge maps. */
export function chunkCellPx(width: number, height: number, cellSize: number): number {
  const total = width * height * cellSize * cellSize
  const res = total > MAX_TERRAIN_PIXELS ? Math.sqrt(MAX_TERRAIN_PIXELS / total) : 1
  return Math.max(4, Math.floor(cellSize * res))
}

/** Draws the tiles of one chunk into a canvas whose origin is the chunk's top-left. */
export function drawTerrainChunk(
  ctx: Ctx,
  tiles: Record<string, string>,
  keys: Iterable<string>,
  chunkX: number,
  chunkY: number,
  cellPx: number,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const ox = chunkX * CHUNK_CELLS
  const oy = chunkY * CHUNK_CELLS
  for (const key of keys) {
    const def = getAsset(tiles[key])
    if (!def) continue
    const c = parseCellKey(key)
    const sprite = getSprite(def, cellPx, hashCoords(c.x, c.y) % TILE_VARIANTS)
    ctx.drawImage(sprite, (c.x - ox) * cellPx, (c.y - oy) * cellPx)
  }
}

export interface WallStyle {
  /** Show secret doors distinctly (editor) or as plain walls (player export). */
  revealSecrets: boolean
}

export function drawWalls(
  ctx: Ctx,
  walls: Record<string, WallEdge>,
  cell: number,
  style: WallStyle,
) {
  const thick = Math.max(2, cell * 0.14)
  const doors: [number, number, boolean, boolean][] = []
  ctx.save()
  ctx.lineCap = 'square'
  ctx.strokeStyle = '#1c1917'
  ctx.lineWidth = thick
  ctx.beginPath()
  for (const key in walls) {
    const e = parseEdgeKey(key)
    const w = walls[key]
    const x = e.x * cell
    const y = e.y * cell
    if (w.door && !(w.secret && !style.revealSecrets)) {
      doors.push([x, y, e.o === 'h', w.secret])
      continue
    }
    ctx.moveTo(x, y)
    if (e.o === 'h') ctx.lineTo(x + cell, y)
    else ctx.lineTo(x, y + cell)
  }
  ctx.stroke()

  for (const [x, y, horizontal, secret] of doors) {
    // Short wall stubs at both ends, with the door leaf in the middle.
    const stub = cell * 0.15
    ctx.beginPath()
    if (horizontal) {
      ctx.moveTo(x, y)
      ctx.lineTo(x + stub, y)
      ctx.moveTo(x + cell - stub, y)
      ctx.lineTo(x + cell, y)
    } else {
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + stub)
      ctx.moveTo(x, y + cell - stub)
      ctx.lineTo(x, y + cell)
    }
    ctx.stroke()
    const len = cell - stub * 2
    const t = thick * 1.6
    const rx = horizontal ? x + stub : x - t / 2
    const ry = horizontal ? y - t / 2 : y + stub
    const rw = horizontal ? len : t
    const rh = horizontal ? t : len
    ctx.fillStyle = secret ? '#7c3aed' : '#a16207'
    ctx.fillRect(rx, ry, rw, rh)
    ctx.lineWidth = Math.max(1, cell * 0.03)
    ctx.strokeRect(rx, ry, rw, rh)
    if (secret) {
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${Math.round(cell * 0.2)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('S', rx + rw / 2, ry + rh / 2)
    }
    ctx.lineWidth = thick
  }
  ctx.restore()
}

export function drawProps(ctx: Ctx, props: PlacedProp[], cell: number) {
  for (const p of props) {
    const def = getAsset(p.defId)
    if (!def) continue
    const fp = rotatedFootprint(def.footprint, p.rotation)
    const sprite = getSprite(def, cell)
    ctx.save()
    ctx.translate((p.x + fp.w / 2) * cell, (p.y + fp.h / 2) * cell)
    ctx.rotate((p.rotation * Math.PI) / 180)
    if (p.mirrored) ctx.scale(-1, 1)
    ctx.drawImage(sprite, (-def.footprint.w * cell) / 2, (-def.footprint.h * cell) / 2)
    ctx.restore()
    if (def.kind === 'token') {
      const text = (p.label || def.name).slice(0, 2).toUpperCase()
      ctx.save()
      ctx.fillStyle = def.art.colors[1] ?? '#fff'
      ctx.font = `bold ${Math.round(cell * 0.32)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, (p.x + 0.5) * cell, (p.y + 0.52) * cell)
      ctx.restore()
    }
  }
}

export function drawNotes(ctx: Ctx, notes: MapNote[], cell: number) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const n of notes) {
    const cx = (n.x + 0.5) * cell
    const cy = (n.y + 0.5) * cell
    if (n.kind === 'room') {
      ctx.beginPath()
      ctx.arc(cx, cy, cell * 0.34, 0, Math.PI * 2)
      ctx.fillStyle = '#b91c1c'
      ctx.fill()
      ctx.lineWidth = Math.max(1, cell * 0.04)
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${Math.round(cell * 0.34)}px sans-serif`
      ctx.fillText(String(n.number ?? '?'), cx, cy + cell * 0.02)
    } else {
      ctx.font = `600 ${Math.round(cell * 0.28)}px sans-serif`
      const w = ctx.measureText(n.text).width + cell * 0.25
      const h = cell * 0.42
      ctx.fillStyle = 'rgba(255, 251, 235, 0.92)'
      ctx.beginPath()
      ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 3)
      ctx.fill()
      ctx.lineWidth = Math.max(1, cell * 0.02)
      ctx.strokeStyle = '#78350f'
      ctx.stroke()
      ctx.fillStyle = '#451a03'
      ctx.fillText(n.text, cx, cy + cell * 0.01)
    }
  }
  ctx.restore()
}
