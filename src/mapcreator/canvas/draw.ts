// Plain Canvas 2D drawing routines in world pixels (1 cell = `cell` px).
// Used by the Konva editor shapes and, later, by the offscreen PNG export.

import { parseCellKey } from '../../lib/geometry'
import { hashCoords } from '../../lib/rng'
import { parseEdgeKey, type MapNote, type PlacedProp, type WallEdge } from '../layers/model'
import { getAsset } from '../tilesets/registry'
import { getSprite, missingAsset } from '../tilesets/spriteCache'
import { edgeMask } from '../tilesets/tilesetFormat'
import { propRect } from '../tools/paint'

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
  drawTiles(ctx, tiles, keys, chunkX * CHUNK_CELLS, chunkY * CHUNK_CELLS, cellPx)
}

/** Draws tiles with cell (ox, oy) at the canvas origin. Used by chunks and export. */
export function drawTiles(
  ctx: Ctx,
  tiles: Record<string, string>,
  keys: Iterable<string>,
  ox: number,
  oy: number,
  cellPx: number,
) {
  for (const key of keys) {
    const id = tiles[key]
    const def = getAsset(id) ?? missingAsset(id)
    const c = parseCellKey(key)
    const mask = def.autotile ? edgeMask(tiles, c.x, c.y, def.autotile.matches) : undefined
    const sprite = getSprite(def, cellPx, hashCoords(c.x, c.y), mask)
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

/** Short label for a token: "Goblin Boss" → "GB", "Monster 3" → "M3". */
export function tokenInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  const last = words[words.length - 1]
  return (words[0][0] + (/^\d+$/.test(last) ? last : last[0])).toUpperCase().slice(0, 3)
}

function hpColor(ratio: number) {
  return ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444'
}

export interface PropStyle {
  /** Draw hidden tokens (faded) — the DM view does, a player view would not. */
  showHidden: boolean
}

export function drawProps(
  ctx: Ctx,
  props: PlacedProp[],
  cell: number,
  style: PropStyle = { showHidden: true },
) {
  for (const p of props) {
    const r = propRect(p)
    const def = getAsset(p.defId) ?? missingAsset(p.defId, { w: r.w, h: r.h })
    const t = p.token
    if (t?.hidden && !style.showHidden) continue
    const sprite = getSprite(def, cell)
    // Unrotated draw size: tokens scale to their creature size.
    const dw = t ? r.w * cell : def.footprint.w * cell
    const dh = t ? r.h * cell : def.footprint.h * cell
    ctx.save()
    if (t?.hidden) ctx.globalAlpha = 0.45
    ctx.translate((r.x + r.w / 2) * cell, (r.y + r.h / 2) * cell)
    if (!t) {
      ctx.rotate((p.rotation * Math.PI) / 180)
      if (p.mirrored) ctx.scale(-1, 1)
    }
    ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
    if (def.kind !== 'token') continue

    const cx = (r.x + r.w / 2) * cell
    const cy = (r.y + r.h / 2) * cell
    const name = t?.name || p.label || def.name
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = def.art.type === 'procedural' ? (def.art.colors[1] ?? '#fff') : '#fff'
    ctx.font = `bold ${Math.round(cell * 0.3 * Math.min(r.w, 2))}px sans-serif`
    if (def.art.type !== 'procedural') {
      ctx.strokeStyle = '#000'
      ctx.lineWidth = Math.max(2, cell * 0.05)
      ctx.strokeText(tokenInitials(name), cx, cy)
    }
    ctx.fillText(tokenInitials(name), cx, cy + cell * 0.02)
    if (t?.hidden) {
      ctx.setLineDash([cell * 0.08, cell * 0.06])
      ctx.strokeStyle = '#a855f7'
      ctx.lineWidth = Math.max(2, cell * 0.04)
      ctx.beginPath()
      ctx.arc(cx, cy, (Math.min(r.w, r.h) * cell) / 2 - cell * 0.03, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (t?.hp && t.hp.max > 0) {
      const ratio = Math.max(0, Math.min(1, t.hp.current / t.hp.max))
      const bw = r.w * cell * 0.8
      const bh = Math.max(3, cell * 0.09)
      const bx = cx - bw / 2
      const by = (r.y + r.h) * cell - bh - cell * 0.03
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2)
      ctx.fillStyle = hpColor(ratio)
      ctx.fillRect(bx, by, bw * ratio, bh)
      if (t.hp.temp > 0) {
        ctx.fillStyle = '#38bdf8'
        ctx.fillRect(bx, by - bh * 0.6, bw * Math.min(1, t.hp.temp / t.hp.max), bh * 0.5)
      }
      if (t.hp.current <= 0) {
        // Down: a red cross over the token.
        const k = (Math.min(r.w, r.h) * cell) / 2 - cell * 0.12
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = Math.max(3, cell * 0.08)
        ctx.beginPath()
        ctx.moveTo(cx - k, cy - k)
        ctx.lineTo(cx + k, cy + k)
        ctx.moveTo(cx + k, cy - k)
        ctx.lineTo(cx - k, cy + k)
        ctx.stroke()
      }
    }
    if (t && t.conditions.length) drawConditionBadges(ctx, t.conditions, r, cell)
    ctx.restore()
  }
}

const CONDITION_COLORS = [
  '#dc2626',
  '#9333ea',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#4f46e5',
  '#059669',
]

/** Colour for a condition name; the same name always gets the same colour. */
export function conditionColor(name: string): string {
  let h = 0
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CONDITION_COLORS[h % CONDITION_COLORS.length]
}

/** Small lettered discs along the top of a token, one per condition (up to four, then "+n"). */
function drawConditionBadges(
  ctx: Ctx,
  conditions: string[],
  r: { x: number; y: number; w: number; h: number },
  cell: number,
) {
  const d = cell * 0.3
  const shown = conditions.slice(0, 4)
  const extra = conditions.length - shown.length
  const maxPerRow = Math.max(1, Math.floor((r.w * cell) / (d * 0.9)))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${Math.round(d * 0.58)}px sans-serif`
  const items = [...shown.map((c) => ({ text: c.slice(0, 2), color: conditionColor(c) }))]
  if (extra > 0) items.push({ text: `+${extra}`, color: '#52525b' })
  items.forEach((it, i) => {
    const col = i % maxPerRow
    const row = Math.floor(i / maxPerRow)
    const cx = r.x * cell + d / 2 + col * d * 0.9
    const cy = r.y * cell + d / 2 + row * d * 0.9
    ctx.beginPath()
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
    ctx.fillStyle = it.color
    ctx.fill()
    ctx.lineWidth = Math.max(1, cell * 0.025)
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(it.text, cx, cy + d * 0.04)
  })
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
