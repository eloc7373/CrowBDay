// Rules content: the bundled original sample, any rules JSON dropped into
// src/data/bundled/ at build time, and packs the user imports (kept in IndexedDB).

import { create } from 'zustand'
import sample from '../../data/rules-sample.json'
import { db } from '../../lib/db'
import { newId } from '../../lib/id'
import { conditionDocs, createSearch, ruleDocs, type SearchDoc } from './search'
import type { RulesPack } from './types'
import { validateRules, type RulesValidation } from './validate'

const SAMPLE_KEY = 'dmtk.sampleRules'

function readSampleEnabled(): boolean {
  try {
    return localStorage.getItem(SAMPLE_KEY) !== 'off'
  } catch {
    return true
  }
}

function samplePack(): RulesPack {
  const v = validateRules(sample)
  if (v.errors.length) console.warn('Sample rules have problems', v.errors)
  return {
    id: 'sample',
    name: sample.name,
    notice: sample.notice,
    entries: v.entries,
    origin: 'sample',
  }
}

/** JSON files in src/data/bundled/ are bundled at build time (none are shipped). */
function bundledPacks(): RulesPack[] {
  const files = import.meta.glob('../../data/bundled/*.json', { eager: true, import: 'default' })
  return Object.entries(files).flatMap(([path, json]) => {
    const v = validateRules(json)
    if (v.errors.length) console.warn(`Rules file ${path} has problems`, v.errors)
    if (!v.entries.length) return []
    const file = path
      .split('/')
      .pop()!
      .replace(/\.json$/, '')
    return [
      {
        id: `bundled:${file}`,
        name: v.name ?? file,
        notice: v.notice,
        entries: v.entries,
        origin: 'bundled' as const,
      },
    ]
  })
}

interface RulesState {
  packs: RulesPack[]
  sampleEnabled: boolean
  docs: SearchDoc[]
  search: (query: string, limit?: number) => SearchDoc[]
  loaded: boolean
  load(): Promise<void>
  setSampleEnabled(on: boolean): void
  importPack(json: unknown, fallbackName: string): Promise<RulesValidation>
  removePack(id: string): Promise<void>
  getDoc(id: string): SearchDoc | undefined
}

function derive(packs: RulesPack[], sampleEnabled: boolean) {
  const active = packs.filter((p) => p.origin !== 'sample' || sampleEnabled)
  // Later packs override earlier ones with the same id (imports beat the sample).
  const byId = new Map(active.flatMap((p) => p.entries).map((e) => [e.id, e]))
  const docs = [...ruleDocs([...byId.values()]), ...conditionDocs()]
  return { docs, search: createSearch(docs) }
}

export const useRulesStore = create<RulesState>()((set, get) => {
  const initialPacks = [samplePack(), ...bundledPacks()]
  const sampleEnabled = readSampleEnabled()
  return {
    packs: initialPacks,
    sampleEnabled,
    ...derive(initialPacks, sampleEnabled),
    loaded: false,

    load: async () => {
      if (get().loaded) return
      try {
        const saved = await db.rulePacks.toArray()
        const imported: RulesPack[] = saved.map((s) => ({ ...s, origin: 'imported' }))
        const packs = [...get().packs.filter((p) => p.origin !== 'imported'), ...imported]
        set({ packs, loaded: true, ...derive(packs, get().sampleEnabled) })
      } catch (err) {
        console.warn('Could not load imported rules', err)
        set({ loaded: true })
      }
    },

    setSampleEnabled: (on) => {
      try {
        localStorage.setItem(SAMPLE_KEY, on ? 'on' : 'off')
      } catch {
        // Not persisted; fine for this session.
      }
      set({ sampleEnabled: on, ...derive(get().packs, on) })
    },

    importPack: async (json, fallbackName) => {
      const v = validateRules(json)
      if (!v.entries.length) return v
      const pack = {
        id: newId('rules'),
        name: v.name ?? fallbackName,
        notice: v.notice,
        entries: v.entries,
      }
      await db.rulePacks.put(pack)
      const packs = [...get().packs, { ...pack, origin: 'imported' as const }]
      set({ packs, ...derive(packs, get().sampleEnabled) })
      return v
    },

    removePack: async (id) => {
      await db.rulePacks.delete(id)
      const packs = get().packs.filter((p) => p.id !== id)
      set({ packs, ...derive(packs, get().sampleEnabled) })
    },

    getDoc: (id) => get().docs.find((d) => d.id === id),
  }
})
