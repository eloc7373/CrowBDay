// Combat state with IndexedDB persistence, so refreshing the page doesn't end combat.

import { create } from 'zustand'
import { db } from '../../lib/db'
import { emptyCombat, type CombatState } from './model'

interface CombatStore {
  state: CombatState
  loaded: boolean
  load(): Promise<void>
  /** Applies a pure model function and persists the result. */
  update(fn: (s: CombatState) => CombatState): void
}

const SAVE_MS = 250
let timer: ReturnType<typeof setTimeout> | undefined
/** Set once the user changes anything, so a slow load can't overwrite it. */
let touched = false

function persist(state: CombatState) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    db.combat
      .put({ id: 'current', state })
      .catch((err) => console.warn('Could not save combat', err))
  }, SAVE_MS)
}

export const useCombatStore = create<CombatStore>()((set, get) => ({
  state: emptyCombat(),
  loaded: false,
  load: async () => {
    if (get().loaded) return
    try {
      const saved = await db.combat.get('current')
      // Edits made before loading finished win over the saved copy.
      if (saved && !touched) set({ state: { ...emptyCombat(), ...saved.state } })
    } catch (err) {
      console.warn('Could not load combat', err)
    }
    set({ loaded: true })
  },
  update: (fn) => {
    const next = fn(get().state)
    if (next === get().state) return
    touched = true
    set({ state: next })
    persist(next)
  },
}))

/** Writes any pending change immediately (e.g. before the page unloads). */
export function flushCombat() {
  if (timer === undefined) return
  clearTimeout(timer)
  timer = undefined
  return db.combat.put({ id: 'current', state: useCombatStore.getState().state })
}
