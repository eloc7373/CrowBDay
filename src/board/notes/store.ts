// Session notes: kept in memory while editing and written to IndexedDB every
// 2 seconds when something changed (and when the page is hidden/closed).

import { create } from 'zustand'
import { db, type SessionNote } from '../../lib/db'
import { newId } from '../../lib/id'

export const AUTOSAVE_MS = 2000

interface NotesStore {
  notes: SessionNote[]
  selectedId: string | null
  dirty: Set<string>
  lastSavedAt: string | null
  loaded: boolean
  load(): Promise<void>
  create(initial?: Partial<SessionNote>): string
  edit(id: string, patch: Partial<Pick<SessionNote, 'title' | 'body' | 'tags' | 'pinned'>>): void
  remove(id: string): Promise<void>
  select(id: string | null): void
  flush(): Promise<void>
}

export const useNotesStore = create<NotesStore>()((set, get) => ({
  notes: [],
  selectedId: null,
  dirty: new Set(),
  lastSavedAt: null,
  loaded: false,

  load: async () => {
    if (get().loaded) return
    try {
      const notes = await db.sessionNotes.toArray()
      const pending = get().notes
      set({
        notes: [...pending, ...notes.filter((n) => !pending.some((p) => p.id === n.id))],
        loaded: true,
      })
    } catch (err) {
      console.warn('Could not load notes', err)
      set({ loaded: true })
    }
    startAutosave()
  },

  create: (initial) => {
    const now = new Date().toISOString()
    const note: SessionNote = {
      id: newId('note'),
      title: 'Untitled note',
      body: '',
      tags: [],
      pinned: 0,
      createdAt: now,
      updatedAt: now,
      ...initial,
    }
    set((s) => ({
      notes: [note, ...s.notes],
      selectedId: note.id,
      dirty: new Set(s.dirty).add(note.id),
    }))
    return note.id
  },

  edit: (id, patch) =>
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
      ),
      dirty: new Set(s.dirty).add(id),
    })),

  remove: async (id) => {
    set((s) => {
      const dirty = new Set(s.dirty)
      dirty.delete(id)
      return {
        notes: s.notes.filter((n) => n.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        dirty,
      }
    })
    await db.sessionNotes.delete(id)
  },

  select: (id) => set({ selectedId: id }),

  flush: async () => {
    const { dirty, notes } = get()
    if (!dirty.size) return
    const toSave = notes.filter((n) => dirty.has(n.id))
    set({ dirty: new Set() })
    try {
      await db.sessionNotes.bulkPut(toSave)
      set({ lastSavedAt: new Date().toISOString() })
    } catch (err) {
      console.warn('Could not save notes', err)
      // Put them back so the next tick retries.
      set((s) => ({ dirty: new Set([...s.dirty, ...toSave.map((n) => n.id)]) }))
    }
  },
}))

let started = false
function startAutosave() {
  if (started) return
  started = true
  setInterval(() => void useNotesStore.getState().flush(), AUTOSAVE_MS)
  const flushNow = () => void useNotesStore.getState().flush()
  window.addEventListener('pagehide', flushNow)
  document.addEventListener(
    'visibilitychange',
    () => document.visibilityState === 'hidden' && flushNow(),
  )
}

/** Pinned first, then most recently edited. */
export function orderedNotes(notes: SessionNote[]): SessionNote[] {
  return [...notes].sort((a, b) => b.pinned - a.pinned || b.updatedAt.localeCompare(a.updatedAt))
}
