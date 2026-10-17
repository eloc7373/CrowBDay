// Editor UI state: tools, options, viewport, previews. Not part of undo history.

import { create } from 'zustand'
import type { Cell, Rect, ShapeMode } from '../../lib/geometry'
import type { CreatureSize, LayerId, PropRotation } from '../layers/model'
import { propFootprint } from '../tools/paint'
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
      w: number
      h: number
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
  /** Size used when stamping creature tokens. */
  tokenSize: CreatureSize
  /** Recently used asset ids, most recent first. */
  recent: string[]
  tilesetDialogOpen: boolean
  generateOpen: boolean
  exportOpen: boolean
  mapsOpen: boolean

  setTool(tool: ToolId): void
  /** Records an asset as recently used (persisted per browser). */
  pushRecent(id: string): void
  set(patch: Partial<EditorState>): void
  flash(status: string): void
}

/** Stamps of tokens go on the Tokens layer; everything else on Objects. */
export const stampLayer = (stampId: string): 'objects' | 'tokens' =>
  getAsset(stampId)?.kind === 'token' ? 'tokens' : 'objects'

/** Footprint of the armed stamp (tokens are sized by creature size). */
export function stampFootprint(s: Pick<EditorState, 'stampId' | 'rotation' | 'tokenSize'>) {
  const isToken = getAsset(s.stampId)?.kind === 'token'
  return propFootprint(s.stampId, s.rotation, isToken ? { size: s.tokenSize } : null)
}

const RECENT_KEY = 'dmtk.recentAssets'
const RECENT_MAX = 10

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

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
  tokenSize: 'medium',
  recent: typeof localStorage === 'undefined' ? [] : loadRecent(),
  tilesetDialogOpen: false,
  generateOpen: false,
  exportOpen: false,
  mapsOpen: false,

  setTool: (tool) =>
    set((s) => ({
      tool,
      preview: null,
      activeLayer: tool === 'stamp' ? stampLayer(s.stampId) : (TOOL_LAYER[tool] ?? s.activeLayer),
    })),
  set: (patch) => set(patch),
  pushRecent: (id) =>
    set((s) => {
      if (s.recent[0] === id) return s
      const recent = [id, ...s.recent.filter((r) => r !== id)].slice(0, RECENT_MAX)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
      } catch {
        // Storage unavailable: the list just won't persist.
      }
      return { recent }
    }),
  flash: (status) => {
    set({ status })
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => set({ status: '' }), 2500)
  },
}))
