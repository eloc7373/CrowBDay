// Undo/redo engine. Every edit is a list of Changes; each Change records the
// value before and after (undefined = absent), so it is trivially reversible.

import type {
  AssetMeta,
  GridSettings,
  MapDoc,
  MapNote,
  PlacedProp,
  WallEdge,
} from '../layers/model'

export const HISTORY_CAP = 200

interface CollectionValues {
  tiles: string
  walls: WallEdge
  props: PlacedProp
  notes: MapNote
  assets: AssetMeta
}
export type Collection = keyof CollectionValues

export type CollectionChange = {
  [C in Collection]: {
    coll: C
    key: string
    before?: CollectionValues[C]
    after?: CollectionValues[C]
  }
}[Collection]

interface MetaValues {
  name: string
  seed: string | null
  grid: GridSettings
  width: number
  height: number
}
export type MetaKey = keyof MetaValues

export type MetaChange = {
  [K in MetaKey]: { coll: 'meta'; key: K; before: MetaValues[K]; after: MetaValues[K] }
}[MetaKey]

export type Change = CollectionChange | MetaChange

export interface HistoryEntry {
  label: string
  changes: Change[]
}

/** Applies changes in order (forward) or undoes them in reverse order (backward). */
export function applyChanges(doc: MapDoc, changes: Change[], dir: 'forward' | 'backward'): MapDoc {
  if (changes.length === 0) return doc
  const next: MapDoc = { ...doc }
  const copied = new Set<string>()
  const list = dir === 'forward' ? changes : [...changes].reverse()
  for (const ch of list) {
    const value = dir === 'forward' ? ch.after : ch.before
    if (ch.coll === 'meta') {
      ;(next as unknown as Record<string, unknown>)[ch.key] = value
      continue
    }
    if (!copied.has(ch.coll)) {
      ;(next as unknown as Record<string, unknown>)[ch.coll] = { ...next[ch.coll] }
      copied.add(ch.coll)
    }
    const coll = next[ch.coll] as Record<string, unknown>
    if (value === undefined) delete coll[ch.key]
    else coll[ch.key] = value
  }
  return next
}

const changeId = (c: Change) => `${c.coll}|${c.key}`

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Accumulates changes into one coalesced entry (e.g. a whole brush stroke).
 * Repeated changes to the same key keep the first `before` and the last `after`;
 * keys that end up unchanged are dropped.
 */
export class Transaction {
  private order: string[] = []
  private byId = new Map<string, Change>()
  label: string

  constructor(label: string) {
    this.label = label
  }

  add(changes: Change[]): void {
    for (const ch of changes) {
      const id = changeId(ch)
      const prev = this.byId.get(id)
      if (prev) this.byId.set(id, { ...prev, after: ch.after } as Change)
      else {
        this.order.push(id)
        this.byId.set(id, ch)
      }
    }
  }

  changes(): Change[] {
    const out: Change[] = []
    for (const id of this.order) {
      const ch = this.byId.get(id)!
      if (!sameValue(ch.before, ch.after)) out.push(ch)
    }
    return out
  }

  /** All changes including no-ops, in order; used to revert a cancelled transaction. */
  rawChanges(): Change[] {
    return this.order.map((id) => this.byId.get(id)!)
  }
}

export function pushEntry(past: HistoryEntry[], entry: HistoryEntry, cap = HISTORY_CAP) {
  const next = [...past, entry]
  return next.length > cap ? next.slice(next.length - cap) : next
}

// ---- Change builders ------------------------------------------------------

/** Change that sets (or deletes, with value undefined) one key; null if no-op. */
export function setChange<C extends Collection>(
  doc: MapDoc,
  coll: C,
  key: string,
  value: CollectionValues[C] | undefined,
): Change | null {
  const before = (doc[coll] as Record<string, CollectionValues[C]>)[key]
  if (sameValue(before, value)) return null
  return { coll, key, before, after: value } as Change
}

export function metaChange<K extends MetaKey>(
  doc: MapDoc,
  key: K,
  value: MetaValues[K],
): Change | null {
  const before = doc[key] as MetaValues[K]
  if (sameValue(before, value)) return null
  return { coll: 'meta', key, before, after: value } as Change
}

export const compact = (list: (Change | null)[]): Change[] =>
  list.filter((c): c is Change => c !== null)
