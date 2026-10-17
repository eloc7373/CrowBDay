// Editor UI state: tools, options, viewport, previews. Not part of undo history.

import { create } from 'zustand'
import type { Cell, Rect, ShapeMode } from '../../lib/geometry'
import type { LayerId, PropRotation } from '../layers/model'
import { getAsset } from '../tilesets/registry'
import type { DiagonalRule } from '../tools/measure'
import { EMPTY_SELECTION, type Selection } from '../tools/select'

export type ToolId =
  | 'brush'
  | 'fill'
  | 'eraser'
  | 'rect'
  | 'ellipse'
  | 'stamp'
  | 'wall'
  | 'select'
  | 'measure'
  | 'pan'
  | 'label'

export type WallMode = 'wall' | 'door' | 'secret'

/** Layer each tool edits; null means "the active layer". */
export const TOOL_LAYER: Record<ToolId, LayerId | null> = {
  brush: 'terrain',
  fill: 'terrain',
  rect: 'terrain',
  ellipse: 'terrain',
  eraser: null,
  stamp: null,
  wall: 'walls',
  select: null,
  measure: null,
  pan: null,
  label: 'notes',
}

export interface View {
  /** screen = world * scale + (x, y) */
  x: number
  y: number
  scale: number
}

export type Preview =
  | { kind: 'cells'; cells: Cell[]; erase?: boolean }
  | {
      kind: 'stamp'
      defId: string
      x: number
      y: number
      rotation: PropRotation
      mirrored: boolean
      valid: boolean
    }
  | { kind: 'wall'; edges: string[]; mode: WallMode; remove: boolean }
  | { kind: 'measure'; from: Cell; to: Cell }
  | { kind: 'rubber'; rect: Rect }
  | { kind: 'move'; dx: number; dy: number }

export interface LabelDraft {
  /** Existing note id when editing; undefined when creating. */
  id?: string
  x: number
  y: number
}

export interface EditorState {
  tool: ToolId
  activeLayer: LayerId
  brushSize: number
  terrainId: string
  stampId: string
  rotation: PropRotation
  mirrored: boolean
  shapeMode: ShapeMode
  wallMode: WallMode
  diagonalRule: DiagonalRule
  fillRespectsWalls: boolean
  selection: Selection
  view: View
  cursor: Cell | null
  preview: Preview | null
  status: string
  helpOpen: boolean
  newMapOpen: boolean
  labelDraft: LabelDraft | null
  spaceHeld: boolean

  setTool(tool: ToolId): void
  set(patch: Partial<EditorState>): void
  flash(status: string): void
}

/** Stamps of tokens go on the Tokens layer; everything else on Objects. */
export const stampLayer = (stampId: string): 'objects' | 'tokens' =>
  getAsset(stampId)?.kind === 'token' ? 'tokens' : 'objects'

let statusTimer: ReturnType<typeof setTimeout> | undefined

export const useEditorStore = create<EditorState>()((set) => ({
  tool: 'brush',
  activeLayer: 'terrain',
  brushSize: 1,
  terrainId: 'stone-floor',
  stampId: 'table',
  rotation: 0,
  mirrored: false,
  shapeMode: 'fill',
  wallMode: 'wall',
  diagonalRule: 'alternating',
  fillRespectsWalls: false,
  selection: EMPTY_SELECTION,
  view: { x: 40, y: 40, scale: 0.5 },
  cursor: null,
  preview: null,
  status: '',
  helpOpen: false,
  newMapOpen: false,
  labelDraft: null,
  spaceHeld: false,

  setTool: (tool) =>
    set((s) => ({
      tool,
      preview: null,
      activeLayer: tool === 'stamp' ? stampLayer(s.stampId) : (TOOL_LAYER[tool] ?? s.activeLayer),
    })),
  set: (patch) => set(patch),
  flash: (status) => {
    set({ status })
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => set({ status: '' }), 2500)
  },
}))
