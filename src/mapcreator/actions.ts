// Editor commands shared by keyboard shortcuts and toolbar buttons.

import { LAYER_IDS, LAYER_NAMES, type LayerId } from './layers/model'
import { canEdit, cancelOperation } from './canvas/controller'
import { fitView } from './canvas/viewport'
import { useEditorStore, type ToolId } from './store/editorStore'
import { useMapStore } from './store/mapStore'
import type { AssetDef } from './tilesets/types'
import { deleteSelection, reorientProps, transformSelection } from './tools/select'

const editor = () => useEditorStore.getState()
const map = () => useMapStore.getState()

/** Size of the canvas element, registered by MapCanvas for fit-to-screen. */
let canvasSize = { w: 1200, h: 800 }
export const setCanvasSize = (w: number, h: number) => {
  canvasSize = { w, h }
}

export function fitToScreen() {
  const { doc } = map()
  editor().set({
    view: fitView(
      doc.width * doc.grid.cellSize,
      doc.height * doc.grid.cellSize,
      canvasSize.w,
      canvasSize.h,
    ),
  })
}

export function zoomBy(factor: number) {
  const { view } = editor()
  const sx = canvasSize.w / 2
  const sy = canvasSize.h / 2
  const scale = Math.min(8, Math.max(0.05, view.scale * factor))
  const k = scale / view.scale
  editor().set({ view: { scale, x: sx - (sx - view.x) * k, y: sy - (sy - view.y) * k } })
}

export function selectTool(tool: ToolId) {
  editor().setTool(tool)
}

const PAINT_TOOLS: ToolId[] = ['brush', 'fill', 'rect', 'ellipse']

/** Arms the right tool for an asset: tiles → paint tools, props/tokens → Stamp. */
export function chooseAsset(def: AssetDef) {
  const ed = editor()
  if (def.kind === 'tile') {
    ed.set({ terrainId: def.id })
    if (!PAINT_TOOLS.includes(ed.tool)) selectTool('brush')
  } else {
    ed.set({ stampId: def.id })
    selectTool('stamp')
  }
  ed.pushRecent(def.id)
}

export const undo = () => {
  cancelOperation()
  map().undo()
  pruneSelection()
}

export const redo = () => {
  cancelOperation()
  map().redo()
  pruneSelection()
}

/** Drops selected ids that no longer exist (e.g. after undo). */
function pruneSelection() {
  const { selection } = editor()
  const { doc } = map()
  const coll = {
    terrain: doc.tiles,
    walls: doc.walls,
    objects: doc.props,
    tokens: doc.props,
    notes: doc.notes,
  }[selection.layer]
  const ids = selection.ids.filter((id) => id in coll)
  if (ids.length !== selection.ids.length) editor().set({ selection: { ...selection, ids } })
}

const hasSelection = () => editor().selection.ids.length > 0

export function deleteSelected() {
  const { selection } = editor()
  if (!hasSelection() || !canEdit(selection.layer)) return
  map().commit('Delete', deleteSelection(map().doc, selection))
  editor().set({ selection: { ...selection, ids: [] } })
}

export function duplicateSelected() {
  const { selection } = editor()
  if (!hasSelection() || !canEdit(selection.layer)) return
  const res = transformSelection(map().doc, selection, 1, 1, true)
  map().commit('Duplicate', res.changes)
  editor().set({ selection: res.selection })
}

export function nudgeSelected(dx: number, dy: number) {
  const { selection } = editor()
  if (!hasSelection() || !canEdit(selection.layer)) return
  const res = transformSelection(map().doc, selection, dx, dy, false)
  map().commit('Move', res.changes)
  editor().set({ selection: res.selection })
}

const propsSelected = () => {
  const { selection, tool } = editor()
  return (
    tool === 'select' &&
    (selection.layer === 'objects' || selection.layer === 'tokens') &&
    selection.ids.length > 0
  )
}

/** R: rotate the stamp (stamp tool) or the selected props; otherwise the rectangle tool. */
export function rotateOrRectangle(counterClockwise: boolean) {
  const ed = editor()
  if (ed.tool === 'stamp') {
    const turn = counterClockwise ? 270 : 90
    ed.set({ rotation: ((ed.rotation + turn) % 360) as typeof ed.rotation })
    return
  }
  if (propsSelected()) {
    if (!canEdit(ed.selection.layer)) return
    map().commit(
      'Rotate',
      reorientProps(map().doc, ed.selection.ids, counterClockwise ? -1 : 1, false),
    )
    return
  }
  selectTool('rect')
}

/** F: mirror the stamp or the selected props. */
export function mirror() {
  const ed = editor()
  if (ed.tool === 'stamp') return ed.set({ mirrored: !ed.mirrored })
  if (propsSelected() && canEdit(ed.selection.layer)) {
    map().commit('Mirror', reorientProps(map().doc, ed.selection.ids, 0, true))
  }
}

export function toggleLayerVisibility(index: number) {
  const id: LayerId | undefined = LAYER_IDS[index]
  if (!id) return
  const visible = !map().doc.layers[id].visible
  map().setLayer(id, { visible })
  editor().flash(`${LAYER_NAMES[id]} ${visible ? 'shown' : 'hidden'}`)
}

export function toggleGrid() {
  const visible = !map().doc.grid.visible
  map().setGrid({ visible })
  editor().flash(`Grid ${visible ? 'on' : 'off'}`)
}

export function changeBrushSize(delta: number) {
  const size = Math.min(8, Math.max(1, editor().brushSize + delta))
  editor().set({ brushSize: size })
  editor().flash(`Brush size ${size}`)
}

/** Centres the view on a note (e.g. a room marker linked from session notes) and selects it. */
export function focusNote(noteId: string): boolean {
  const { doc } = map()
  const n = doc.notes[noteId]
  if (!n) return false
  const { view } = editor()
  const scale = Math.max(view.scale, 0.6)
  const cell = doc.grid.cellSize
  editor().set({
    view: {
      scale,
      x: canvasSize.w / 2 - (n.x + 0.5) * cell * scale,
      y: canvasSize.h / 2 - (n.y + 0.5) * cell * scale,
    },
    tool: 'select',
    activeLayer: 'notes',
    selection: { layer: 'notes', ids: [noteId] },
    preview: null,
  })
  editor().flash(n.kind === 'room' ? `Room ${n.number}: ${n.text}` : n.text)
  return true
}
