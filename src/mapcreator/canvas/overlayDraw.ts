// Tool previews and selection highlights, drawn in world space. Line widths and
// text are divided by the zoom scale so they stay a constant size on screen.

import { drawCombat, drawTrail, NO_COMBAT, type CombatOverlay } from '../../combat/draw'
import { cellLabel, parseCellKey } from '../../lib/geometry'
import { parseEdgeKey, type MapDoc } from '../layers/model'
import type { Preview, WallMode } from '../store/editorStore'
import { getAsset } from '../tilesets/registry'
import { getSprite } from '../tilesets/spriteCache'
import { measure, type DiagonalRule } from '../tools/measure'
import { propRect } from '../tools/paint'
import type { Selection } from '../tools/select'

type Ctx = CanvasRenderingContext2D

const WALL_COLORS: Record<WallMode, string> = {
  wall: '#06b6d4',
  door: '#f59e0b',
  secret: '#a855f7',
}
const SELECT = '#facc15'

function edgePath(ctx: Ctx, keys: string[], cell: number, dx = 0, dy = 0) {
  ctx.beginPath()
  for (const k of keys) {
    const e = parseEdgeKey(k)
    const x = (e.x + dx) * cell
    const y = (e.y + dy) * cell
    ctx.moveTo(x, y)
    if (e.o === 'h') ctx.lineTo(x + cell, y)
    else ctx.lineTo(x, y + cell)
  }
}

function drawSelection(
  ctx: Ctx,
  doc: MapDoc,
  sel: Selection,
  cell: number,
  px: number,
  dx: number,
  dy: number,
) {
  if (!sel.ids.length) return
  ctx.save()
  ctx.strokeStyle = SELECT
  ctx.lineWidth = 2 * px
  ctx.setLineDash([6 * px, 4 * px])
  switch (sel.layer) {
    case 'terrain':
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)'
      for (const k of sel.ids) {
        const c = parseCellKey(k)
        ctx.fillRect((c.x + dx) * cell, (c.y + dy) * cell, cell, cell)
      }
      break
    case 'walls':
      ctx.setLineDash([])
      ctx.lineWidth = Math.max(4 * px, cell * 0.2)
      ctx.globalAlpha = 0.7
      edgePath(ctx, sel.ids, cell, dx, dy)
      ctx.stroke()
      break
    case 'objects':
    case 'tokens':
      for (const id of sel.ids) {
        const p = doc.props[id]
        if (!p) continue
        const r = propRect(p)
        ctx.strokeRect((r.x + dx) * cell, (r.y + dy) * cell, r.w * cell, r.h * cell)
      }
      break
    case 'notes':
      for (const id of sel.ids) {
        const n = doc.notes[id]
        if (n) ctx.strokeRect((n.x + dx) * cell, (n.y + dy) * cell, cell, cell)
      }
      break
  }
  ctx.restore()
}

export function label(ctx: Ctx, text: string, x: number, y: number, px: number) {
  ctx.save()
  ctx.font = `600 ${13 * px}px system-ui, sans-serif`
  const w = ctx.measureText(text).width + 12 * px
  const h = 22 * px
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h - 8 * px, w, h, 4 * px)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y - h / 2 - 8 * px)
  ctx.restore()
}

export function drawOverlay(
  ctx: Ctx,
  doc: MapDoc,
  preview: Preview | null,
  selection: Selection,
  scale: number,
  diagonalRule: DiagonalRule,
  combat: CombatOverlay = NO_COMBAT,
) {
  const cell = doc.grid.cellSize
  const px = 1 / scale
  const moving = preview?.kind === 'move' ? preview : null
  drawCombat(ctx, doc, combat, px)
  drawSelection(ctx, doc, selection, cell, px, moving?.dx ?? 0, moving?.dy ?? 0)
  if (moving?.trail) drawTrail(ctx, moving.trail, cell, px, label)
  if (!preview) return

  ctx.save()
  switch (preview.kind) {
    case 'cells': {
      ctx.fillStyle = preview.erase ? 'rgba(239, 68, 68, 0.35)' : 'rgba(59, 130, 246, 0.35)'
      ctx.strokeStyle = preview.erase ? '#ef4444' : '#3b82f6'
      ctx.lineWidth = 1.5 * px
      for (const c of preview.cells) {
        if (c.x < 0 || c.y < 0 || c.x >= doc.width || c.y >= doc.height) continue
        ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
        ctx.strokeRect(c.x * cell, c.y * cell, cell, cell)
      }
      break
    }
    case 'stamp': {
      const def = getAsset(preview.defId)
      if (!def) break
      const r = { x: preview.x, y: preview.y, w: preview.w, h: preview.h }
      const isToken = def.kind === 'token'
      // Tokens scale to creature size and never rotate; props use their own footprint.
      const dw = (isToken ? r.w : def.footprint.w) * cell
      const dh = (isToken ? r.h : def.footprint.h) * cell
      ctx.save()
      ctx.globalAlpha = 0.6
      ctx.translate((r.x + r.w / 2) * cell, (r.y + r.h / 2) * cell)
      if (!isToken) {
        ctx.rotate((preview.rotation * Math.PI) / 180)
        if (preview.mirrored) ctx.scale(-1, 1)
      }
      ctx.drawImage(getSprite(def, cell), -dw / 2, -dh / 2, dw, dh)
      ctx.restore()
      ctx.strokeStyle = preview.valid ? '#22c55e' : '#ef4444'
      ctx.lineWidth = 2 * px
      ctx.strokeRect(r.x * cell, r.y * cell, r.w * cell, r.h * cell)
      break
    }
    case 'wall': {
      ctx.strokeStyle = preview.remove ? '#ef4444' : WALL_COLORS[preview.mode]
      ctx.lineWidth = Math.max(4 * px, cell * 0.12)
      ctx.lineCap = 'round'
      if (preview.remove) ctx.setLineDash([8 * px, 6 * px])
      edgePath(ctx, preview.edges, cell)
      ctx.stroke()
      break
    }
    case 'measure': {
      const { from, to } = preview
      const ax = (from.x + 0.5) * cell
      const ay = (from.y + 0.5) * cell
      const bx = (to.x + 0.5) * cell
      const by = (to.y + 0.5) * cell
      ctx.strokeStyle = '#f43f5e'
      ctx.fillStyle = '#f43f5e'
      ctx.lineWidth = 3 * px
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
      for (const [x, y] of [
        [ax, ay],
        [bx, by],
      ]) {
        ctx.beginPath()
        ctx.arc(x, y, 5 * px, 0, Math.PI * 2)
        ctx.fill()
      }
      const m = measure(from, to, diagonalRule, doc.grid.feetPerCell)
      label(ctx, `${m.feet} ft · ${m.squares} sq → ${cellLabel(to.x, to.y)}`, bx, by, px)
      break
    }
    case 'rubber': {
      const r = preview.rect
      ctx.fillStyle = 'rgba(250, 204, 21, 0.12)'
      ctx.strokeStyle = SELECT
      ctx.lineWidth = 1.5 * px
      ctx.setLineDash([5 * px, 4 * px])
      ctx.fillRect(r.x * cell, r.y * cell, r.w * cell, r.h * cell)
      ctx.strokeRect(r.x * cell, r.y * cell, r.w * cell, r.h * cell)
      break
    }
    case 'move':
      break
  }
  ctx.restore()
}
