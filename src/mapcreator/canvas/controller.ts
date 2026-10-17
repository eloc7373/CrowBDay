// Pointer-driven tool state machine. Converts screen input into cell coordinates
// and store edits. Kept outside React so pointer moves don't re-render the tree.

import {
  brushCells,
  brushLineCells,
  clamp,
  ellipseCells,
  rectCells,
  rectFromCells,
  type Cell,
} from '../../lib/geometry'
import { newId } from '../../lib/id'
import {
  constrainVertex,
  edgeInBounds,
  edgesBetweenVertices,
  LAYER_NAMES,
  nearestEdge,
  parseEdgeKey,
  type LayerId,
  type WallEdge,
} from '../layers/model'
import { useEditorStore, stampLayer, type Preview } from '../store/editorStore'
import { compact, setChange } from '../store/history'
import { useMapStore } from '../store/mapStore'
import { getAsset } from '../tilesets/registry'
import { eraseChanges, fillChanges, paintChanges, sampleAt } from '../tools/paint'
import { clampDelta, hitTest, itemsInRect, stampAnchor, transformSelection } from '../tools/select'
import { isMouseWheel, screenToWorld, zoomAt } from './viewport'

type Vertex = { x: number; y: number }

/** Satisfied by both DOM and React pointer events. */
type PointerLike = Pick<
  PointerEvent,
  'clientX' | 'clientY' | 'button' | 'pointerId' | 'shiftKey' | 'altKey' | 'preventDefault'
>

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'paint'; erase: boolean; last: Cell; line: Cell | null }
  | { kind: 'shape'; start: Cell }
  | { kind: 'wall'; start: Vertex; remove: boolean; moved: boolean }
  | { kind: 'measure'; start: Cell }
  | { kind: 'move'; start: Cell; dx: number; dy: number }
  | { kind: 'rubber'; start: Cell; additive: boolean }
  | { kind: 'label'; cell: Cell }

let drag: Drag | null = null
/** End of the previous brush stroke, for Shift+click straight lines. */
let lastPaint: Cell | null = null

const editor = () => useEditorStore.getState()
const map = () => useMapStore.getState()

interface Point {
  sx: number
  sy: number
  /** Position in cell units (fractional). */
  u: number
  v: number
  cell: Cell
}

function point(e: { clientX: number; clientY: number }, el: HTMLElement): Point {
  const r = el.getBoundingClientRect()
  const sx = e.clientX - r.left
  const sy = e.clientY - r.top
  const w = screenToWorld(editor().view, sx, sy)
  const cs = map().doc.grid.cellSize
  const u = w.x / cs
  const v = w.y / cs
  return { sx, sy, u, v, cell: { x: Math.floor(u), y: Math.floor(v) } }
}

/** Layers must be visible and unlocked to edit; explains why not otherwise. */
export function canEdit(layer: LayerId): boolean {
  const ls = map().doc.layers[layer]
  if (ls.locked) {
    editor().flash(`${LAYER_NAMES[layer]} layer is locked`)
    return false
  }
  if (!ls.visible) {
    editor().flash(`${LAYER_NAMES[layer]} layer is hidden`)
    return false
  }
  return true
}

const setPreview = (preview: Preview | null) => editor().set({ preview })

function nearestVertex(p: Point): Vertex {
  const { width, height } = map().doc
  return { x: clamp(Math.round(p.u), 0, width), y: clamp(Math.round(p.v), 0, height) }
}

function wallEdges(a: Vertex, b: Vertex): string[] {
  const { width, height } = map().doc
  return edgesBetweenVertices(a, constrainVertex(a, b)).filter((k) =>
    edgeInBounds(parseEdgeKey(k), width, height),
  )
}

function wallValue(): WallEdge {
  const mode = editor().wallMode
  return { door: mode !== 'wall', secret: mode === 'secret' }
}

function strokeCells(from: Cell, to: Cell): Cell[] {
  return brushLineCells(from, to, editor().brushSize)
}

function applyStroke(cells: Cell[], erase: boolean) {
  const doc = map().doc
  const ed = editor()
  map().txApply(
    erase ? eraseChanges(doc, ed.activeLayer, cells) : paintChanges(doc, cells, ed.terrainId),
  )
}

function eyedrop(cell: Cell) {
  const ed = editor()
  const layer =
    ed.tool === 'brush' || ed.tool === 'fill' || ed.tool === 'rect' || ed.tool === 'ellipse'
      ? 'terrain'
      : ed.activeLayer
  const id = sampleAt(map().doc, layer, cell)
  if (!id) return ed.flash('Nothing to sample here')
  const def = getAsset(id)
  if (def?.kind === 'tile') ed.set({ terrainId: id })
  else ed.set({ stampId: id })
  ed.flash(`Sampled ${def?.name ?? id}`)
}

/** Hover preview when no drag is in progress. */
function hoverPreview(p: Point) {
  const ed = editor()
  const doc = map().doc
  switch (ed.tool) {
    case 'brush':
    case 'eraser':
      return setPreview({
        kind: 'cells',
        cells: brushCells(p.cell.x, p.cell.y, ed.brushSize),
        erase: ed.tool === 'eraser',
      })
    case 'fill':
    case 'rect':
    case 'ellipse':
    case 'label':
      return setPreview({ kind: 'cells', cells: [p.cell] })
    case 'stamp': {
      const a = stampAnchor(doc, ed.stampId, ed.rotation, p.cell.x, p.cell.y)
      return setPreview({
        kind: 'stamp',
        defId: ed.stampId,
        x: a.x,
        y: a.y,
        rotation: ed.rotation,
        mirrored: ed.mirrored,
        valid: a.valid,
      })
    }
    case 'wall': {
      const e = nearestEdge(p.u, p.v)
      const ok = e.dist < 0.35 && edgeInBounds(parseEdgeKey(e.key), doc.width, doc.height)
      return setPreview(
        ok ? { kind: 'wall', edges: [e.key], mode: ed.wallMode, remove: false } : null,
      )
    }
    case 'measure':
      // Keep the last measurement on screen until a new one starts.
      if (ed.preview?.kind !== 'measure') setPreview(null)
      return
    default:
      if (ed.preview) setPreview(null)
  }
}

export function pointerDown(e: PointerLike, el: HTMLElement) {
  const ed = editor()
  const p = point(e, el)
  if (e.button === 1 || (e.button === 0 && (ed.spaceHeld || ed.tool === 'pan'))) {
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    drag = { kind: 'pan', sx: p.sx, sy: p.sy, vx: ed.view.x, vy: ed.view.y }
    return
  }
  if (e.button === 2 && ed.tool === 'wall' && canEdit('walls')) {
    el.setPointerCapture(e.pointerId)
    drag = { kind: 'wall', start: nearestVertex(p), remove: true, moved: false }
    return
  }
  if (e.button !== 0) return
  el.setPointerCapture(e.pointerId)
  const doc = map().doc

  switch (ed.tool) {
    case 'brush':
    case 'eraser': {
      if (e.altKey && ed.tool === 'brush') return eyedrop(p.cell)
      const erase = ed.tool === 'eraser'
      if (!canEdit(erase ? ed.activeLayer : 'terrain')) return
      map().beginTx(erase ? 'Erase' : 'Paint')
      if (e.shiftKey) {
        const start = lastPaint ?? p.cell
        drag = { kind: 'paint', erase, last: p.cell, line: start }
        setPreview({ kind: 'cells', cells: strokeCells(start, p.cell), erase })
      } else {
        drag = { kind: 'paint', erase, last: p.cell, line: null }
        applyStroke(brushCells(p.cell.x, p.cell.y, ed.brushSize), erase)
      }
      return
    }
    case 'fill': {
      if (e.altKey) return eyedrop(p.cell)
      if (!canEdit('terrain')) return
      const changes = fillChanges(doc, p.cell, ed.terrainId, ed.fillRespectsWalls)
      map().commit('Fill', changes)
      if (changes.length) ed.flash(`Filled ${changes.length} cells`)
      return
    }
    case 'rect':
    case 'ellipse':
      if (e.altKey) return eyedrop(p.cell)
      if (!canEdit('terrain')) return
      drag = { kind: 'shape', start: p.cell }
      setPreview({ kind: 'cells', cells: [p.cell] })
      return
    case 'stamp': {
      if (e.altKey) return eyedrop(p.cell)
      const layer = stampLayer(ed.stampId)
      if (!canEdit(layer)) return
      const a = stampAnchor(doc, ed.stampId, ed.rotation, p.cell.x, p.cell.y)
      if (!a.valid) return ed.flash('Stamp does not fit inside the map here')
      const id = newId('prop')
      map().commit(
        'Stamp',
        compact([
          setChange(doc, 'props', id, {
            id,
            layer,
            defId: ed.stampId,
            x: a.x,
            y: a.y,
            rotation: ed.rotation,
            mirrored: ed.mirrored,
          }),
        ]),
      )
      return
    }
    case 'wall':
      if (!canEdit('walls')) return
      drag = { kind: 'wall', start: nearestVertex(p), remove: false, moved: false }
      return
    case 'select': {
      const layer = ed.activeLayer
      const hit = hitTest(doc, layer, p.u, p.v)
      const current = ed.selection.layer === layer ? ed.selection.ids : []
      if (hit) {
        if (e.shiftKey) {
          const ids = current.includes(hit) ? current.filter((i) => i !== hit) : [...current, hit]
          ed.set({ selection: { layer, ids } })
          return
        }
        if (!current.includes(hit)) ed.set({ selection: { layer, ids: [hit] } })
        if (!doc.layers[layer].locked) drag = { kind: 'move', start: p.cell, dx: 0, dy: 0 }
        return
      }
      drag = { kind: 'rubber', start: p.cell, additive: e.shiftKey }
      if (!e.shiftKey) ed.set({ selection: { layer, ids: [] } })
      setPreview({ kind: 'rubber', rect: rectFromCells(p.cell, p.cell) })
      return
    }
    case 'measure':
      drag = { kind: 'measure', start: p.cell }
      setPreview({ kind: 'measure', from: p.cell, to: p.cell })
      return
    case 'label':
      // The dialog opens on pointer-up: opening it here would let the browser's
      // mousedown default action steal focus back from the dialog's text field.
      if (canEdit('notes')) drag = { kind: 'label', cell: p.cell }
      return
  }
}

export function pointerMove(e: PointerLike, el: HTMLElement) {
  const ed = editor()
  const p = point(e, el)
  const doc = map().doc
  const inside = p.cell.x >= 0 && p.cell.y >= 0 && p.cell.x < doc.width && p.cell.y < doc.height
  const cur = ed.cursor
  if (!inside) {
    if (cur) ed.set({ cursor: null })
  } else if (!cur || cur.x !== p.cell.x || cur.y !== p.cell.y) {
    ed.set({ cursor: p.cell })
  }

  if (!drag) return hoverPreview(p)
  switch (drag.kind) {
    case 'pan':
      ed.set({ view: { ...ed.view, x: drag.vx + p.sx - drag.sx, y: drag.vy + p.sy - drag.sy } })
      return
    case 'paint':
      if (drag.line) {
        setPreview({ kind: 'cells', cells: strokeCells(drag.line, p.cell), erase: drag.erase })
      } else if (p.cell.x !== drag.last.x || p.cell.y !== drag.last.y) {
        // Fill the gap between pointer samples so fast strokes stay continuous.
        applyStroke(strokeCells(drag.last, p.cell), drag.erase)
        setPreview({
          kind: 'cells',
          cells: brushCells(p.cell.x, p.cell.y, ed.brushSize),
          erase: drag.erase,
        })
      }
      drag.last = p.cell
      return
    case 'shape': {
      const fn = ed.tool === 'ellipse' ? ellipseCells : rectCells
      setPreview({ kind: 'cells', cells: fn(drag.start, p.cell, ed.shapeMode) })
      return
    }
    case 'wall': {
      const v = nearestVertex(p)
      if (v.x !== drag.start.x || v.y !== drag.start.y) drag.moved = true
      setPreview({
        kind: 'wall',
        edges: wallEdges(drag.start, v),
        mode: ed.wallMode,
        remove: drag.remove,
      })
      return
    }
    case 'measure':
      setPreview({ kind: 'measure', from: drag.start, to: p.cell })
      return
    case 'move': {
      const d = clampDelta(doc, ed.selection, p.cell.x - drag.start.x, p.cell.y - drag.start.y)
      if (d.dx !== drag.dx || d.dy !== drag.dy) {
        drag.dx = d.dx
        drag.dy = d.dy
        setPreview({ kind: 'move', dx: d.dx, dy: d.dy })
      }
      return
    }
    case 'rubber':
      setPreview({ kind: 'rubber', rect: rectFromCells(drag.start, p.cell) })
      return
  }
}

export function pointerUp(e: PointerLike, el: HTMLElement) {
  const d = drag
  drag = null
  if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  if (!d) return
  const ed = editor()
  const p = point(e, el)
  const doc = map().doc

  switch (d.kind) {
    case 'pan':
      break
    case 'paint':
      if (d.line) applyStroke(strokeCells(d.line, p.cell), d.erase)
      map().endTx()
      lastPaint = d.last
      break
    case 'shape': {
      const fn = ed.tool === 'ellipse' ? ellipseCells : rectCells
      map().commit(
        ed.tool === 'ellipse' ? 'Ellipse' : 'Rectangle',
        paintChanges(doc, fn(d.start, p.cell, ed.shapeMode), ed.terrainId),
      )
      break
    }
    case 'wall': {
      let edges: string[]
      if (d.moved) edges = wallEdges(d.start, nearestVertex(p))
      else {
        // A click (no drag) applies the current mode to the nearest single edge.
        const near = nearestEdge(p.u, p.v)
        edges =
          near.dist < 0.35 && edgeInBounds(parseEdgeKey(near.key), doc.width, doc.height)
            ? [near.key]
            : []
      }
      const value = d.remove ? undefined : wallValue()
      const label = d.remove ? 'Remove walls' : ed.wallMode === 'wall' ? 'Wall' : 'Door'
      map().commit(label, compact(edges.map((k) => setChange(doc, 'walls', k, value))))
      break
    }
    case 'measure':
      return // keep the measurement preview
    case 'label': {
      const existing = hitTest(doc, 'notes', d.cell.x + 0.5, d.cell.y + 0.5)
      ed.set({ labelDraft: existing ? { id: existing, ...d.cell } : { ...d.cell } })
      break
    }
    case 'move':
      if (d.dx || d.dy) {
        const { changes, selection } = transformSelection(doc, ed.selection, d.dx, d.dy, false)
        map().commit('Move', changes)
        ed.set({ selection })
      }
      break
    case 'rubber': {
      const r = rectFromCells(d.start, p.cell)
      const layer = ed.activeLayer
      const ids = itemsInRect(doc, layer, r)
      const base = d.additive && ed.selection.layer === layer ? ed.selection.ids : []
      ed.set({ selection: { layer, ids: [...new Set([...base, ...ids])] } })
      break
    }
  }
  setPreview(null)
  hoverPreview(p)
}

export function pointerLeave() {
  if (drag) return
  const ed = editor()
  ed.set({ cursor: null, preview: ed.preview?.kind === 'measure' ? ed.preview : null })
}

/** Escape: abort the current gesture; with nothing in progress, clear the selection. */
export function cancelOperation() {
  const ed = editor()
  if (drag) {
    if (drag.kind === 'paint') map().cancelTx()
    drag = null
    setPreview(null)
    return
  }
  ed.set({ preview: null, selection: { layer: ed.selection.layer, ids: [] } })
}

export const isDragging = () => drag !== null

export function wheel(e: WheelEvent, el: HTMLElement) {
  e.preventDefault()
  const ed = editor()
  const r = el.getBoundingClientRect()
  const sx = e.clientX - r.left
  const sy = e.clientY - r.top
  if (e.ctrlKey) {
    // Trackpad pinch (and Ctrl+wheel) → smooth zoom.
    ed.set({ view: zoomAt(ed.view, sx, sy, Math.exp(-e.deltaY * 0.01)) })
  } else if (isMouseWheel(e)) {
    ed.set({ view: zoomAt(ed.view, sx, sy, e.deltaY < 0 ? 1.15 : 1 / 1.15) })
  } else {
    // Two-finger trackpad scroll → pan.
    ed.set({ view: { ...ed.view, x: ed.view.x - e.deltaX, y: ed.view.y - e.deltaY } })
  }
}

/** Exposed for tests: resets module-level gesture state. */
export function resetController() {
  drag = null
  lastPaint = null
}
