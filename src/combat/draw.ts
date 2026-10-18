// Combat Mode drawing on the map overlay: the active creature, reach/range rings,
// area templates and the movement trail. World space; line widths are divided by
// the zoom scale (`px`) so they stay a constant size on screen.

import type { MapDoc } from '../mapcreator/layers/model'
import type { MoveTrail } from '../mapcreator/store/editorStore'
import { propRect } from '../mapcreator/tools/paint'
import { templateCellsOnMap, type Template } from './templates'

type Ctx = CanvasRenderingContext2D

export interface CombatOverlay {
  /** Token of the creature whose turn it is (on this map). */
  activeTokenId: string | null
  template: Template | null
  /** Reach/range rings in feet, drawn around `ringTokenId`. */
  rings: number[]
  ringTokenId: string | null
}

export const NO_COMBAT: CombatOverlay = {
  activeTokenId: null,
  template: null,
  rings: [],
  ringTokenId: null,
}

const TEMPLATE_FILL = 'rgba(244, 63, 94, 0.28)'
const TEMPLATE_STROKE = '#f43f5e'

export function drawCombat(ctx: Ctx, doc: MapDoc, combat: CombatOverlay, px: number) {
  const cell = doc.grid.cellSize
  ctx.save()
  const active = combat.activeTokenId ? doc.props[combat.activeTokenId] : undefined
  if (active) {
    const r = propRect(active)
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 4 * px
    ctx.strokeRect(r.x * cell, r.y * cell, r.w * cell, r.h * cell)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 1.5 * px
    ctx.strokeRect(
      r.x * cell + 3 * px,
      r.y * cell + 3 * px,
      r.w * cell - 6 * px,
      r.h * cell - 6 * px,
    )
  }

  const ringToken = combat.ringTokenId ? doc.props[combat.ringTokenId] : undefined
  if (ringToken && combat.rings.length) {
    const r = propRect(ringToken)
    const cx = (r.x + r.w / 2) * cell
    const cy = (r.y + r.h / 2) * cell
    ctx.strokeStyle = '#0ea5e9'
    ctx.fillStyle = '#0ea5e9'
    ctx.lineWidth = 2 * px
    for (const ft of [...combat.rings].sort((a, b) => a - b)) {
      // Distance is measured from the edge of the creature.
      const radius = ((r.w + r.h) / 4 + ft / doc.grid.feetPerCell) * cell
      ctx.setLineDash([10 * px, 6 * px])
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = `600 ${12 * px}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${ft} ft`, cx, cy - radius - 2 * px)
    }
  }

  const t = combat.template
  if (t) {
    ctx.fillStyle = TEMPLATE_FILL
    ctx.strokeStyle = TEMPLATE_STROKE
    ctx.lineWidth = 1 * px
    for (const c of templateCellsOnMap(t, doc)) {
      ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
      ctx.strokeRect(c.x * cell, c.y * cell, cell, cell)
    }
    const o = t.origin
    ctx.fillStyle = TEMPLATE_STROKE
    ctx.beginPath()
    ctx.arc((o.x + 0.5) * cell, (o.y + 0.5) * cell, 5 * px, 0, Math.PI * 2)
    ctx.fill()
    if (t.shape === 'cone' || t.shape === 'line') {
      ctx.lineWidth = 2 * px
      ctx.beginPath()
      ctx.moveTo((o.x + 0.5) * cell, (o.y + 0.5) * cell)
      ctx.lineTo((t.target.x + 0.5) * cell, (t.target.y + 0.5) * cell)
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** The dragged token's route, green while within speed and red once past it. */
export function drawTrail(
  ctx: Ctx,
  trail: MoveTrail,
  cell: number,
  px: number,
  label: (ctx: Ctx, text: string, x: number, y: number, px: number) => void,
) {
  const over = trail.speed !== null && trail.used + trail.feet > trail.speed
  const color = over ? '#ef4444' : '#22c55e'
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3 * px
  ctx.lineJoin = 'round'
  if (trail.straight) ctx.setLineDash([8 * px, 6 * px])
  ctx.beginPath()
  trail.cells.forEach((c, i) => {
    const x = (c.x + 0.5) * cell
    const y = (c.y + 0.5) * cell
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.restore()
  const end = trail.cells[trail.cells.length - 1]
  if (end) {
    const left =
      trail.speed !== null ? ` · ${Math.max(0, trail.speed - trail.used - trail.feet)} ft left` : ''
    const warn = over ? ' · over speed' : ''
    label(
      ctx,
      `${trail.feet} ft${left}${warn}${trail.straight ? ' (no clear path)' : ''}`,
      (end.x + 0.5) * cell,
      (end.y + 0.5) * cell,
      px,
    )
  }
}
