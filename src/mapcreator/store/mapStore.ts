import { create } from 'zustand'
import {
  createEmptyMap,
  type GridSettings,
  type LayerId,
  type LayerState,
  type MapDoc,
  type NewMapOptions,
} from '../layers/model'
import { assetMeta, getAsset } from '../tilesets/registry'
import { applyChanges, pushEntry, Transaction, type Change, type HistoryEntry } from './history'

/**
 * Appends metadata changes for assets newly referenced by tiles/props, so the map
 * always carries the flags of what it uses. They are part of the same undo step.
 */
export function withAssetMeta(doc: MapDoc, changes: Change[]): Change[] {
  const extra: Change[] = []
  const seen = new Set<string>()
  for (const ch of changes) {
    const id = ch.coll === 'tiles' ? ch.after : ch.coll === 'props' ? ch.after?.defId : undefined
    if (!id || seen.has(id) || doc.assets[id]) continue
    seen.add(id)
    const def = getAsset(id)
    if (def) extra.push({ coll: 'assets', key: id, before: undefined, after: assetMeta(def) })
  }
  return extra.length ? [...changes, ...extra] : changes
}

export interface MapState {
  doc: MapDoc
  past: HistoryEntry[]
  future: HistoryEntry[]
  tx: Transaction | null

  /** Replaces the document and clears history (new map / load). */
  loadDoc(doc: MapDoc): void
  newMap(opts?: NewMapOptions): void

  /** Applies a self-contained edit as one undo step. */
  commit(label: string, changes: Change[]): void

  /** Coalesced edits (brush strokes, drags): begin → apply* → end or cancel. */
  beginTx(label: string): void
  txApply(changes: Change[]): void
  endTx(): void
  cancelTx(): void

  undo(): void
  redo(): void

  /** Layer visibility/lock/opacity are view settings: persisted, not undoable. */
  setLayer(id: LayerId, patch: Partial<LayerState>): void
  /** Grid display/scale settings and the map name are also non-undoable settings. */
  setGrid(patch: Partial<GridSettings>): void
  setName(name: string): void
}

export const useMapStore = create<MapState>()((set, get) => ({
  doc: createEmptyMap(),
  past: [],
  future: [],
  tx: null,

  loadDoc: (doc) => set({ doc, past: [], future: [], tx: null }),
  newMap: (opts) => set({ doc: createEmptyMap(opts), past: [], future: [], tx: null }),

  commit: (label, changes) => {
    if (get().tx) get().endTx()
    if (changes.length === 0) return
    const { doc, past } = get()
    changes = withAssetMeta(doc, changes)
    set({
      doc: applyChanges(doc, changes, 'forward'),
      past: pushEntry(past, { label, changes }),
      future: [],
    })
  },

  beginTx: (label) => {
    if (get().tx) get().endTx()
    set({ tx: new Transaction(label) })
  },

  txApply: (changes) => {
    const { tx, doc } = get()
    if (!tx || changes.length === 0) return
    changes = withAssetMeta(doc, changes)
    tx.add(changes)
    set({ doc: applyChanges(doc, changes, 'forward') })
  },

  endTx: () => {
    const { tx, past } = get()
    if (!tx) return
    const changes = tx.changes()
    if (changes.length === 0) set({ tx: null })
    else set({ tx: null, past: pushEntry(past, { label: tx.label, changes }), future: [] })
  },

  cancelTx: () => {
    const { tx, doc } = get()
    if (!tx) return
    set({ tx: null, doc: applyChanges(doc, tx.rawChanges(), 'backward') })
  },

  undo: () => {
    if (get().tx) get().endTx()
    const { past, future, doc } = get()
    const entry = past[past.length - 1]
    if (!entry) return
    set({
      doc: applyChanges(doc, entry.changes, 'backward'),
      past: past.slice(0, -1),
      future: [...future, entry],
    })
  },

  redo: () => {
    if (get().tx) get().endTx()
    const { past, future, doc } = get()
    const entry = future[future.length - 1]
    if (!entry) return
    set({
      doc: applyChanges(doc, entry.changes, 'forward'),
      past: pushEntry(past, entry),
      future: future.slice(0, -1),
    })
  },

  setLayer: (id, patch) => {
    const { doc } = get()
    set({ doc: { ...doc, layers: { ...doc.layers, [id]: { ...doc.layers[id], ...patch } } } })
  },

  setGrid: (patch) => {
    const { doc } = get()
    set({ doc: { ...doc, grid: { ...doc.grid, ...patch } } })
  },

  setName: (name) => set({ doc: { ...get().doc, name } }),
}))
