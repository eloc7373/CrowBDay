import { create } from 'zustand'
import { db } from '../../lib/db'
import type { CampaignRecord, CampaignSession, CreatureTemplate, EncounterTemplate } from './types'

interface CampaignStore {
  creatures: CreatureTemplate[]
  encounters: EncounterTemplate[]
  sessions: CampaignSession[]
  records: CampaignRecord[]
  loaded: boolean
  load(): Promise<void>
  saveCreature(value: CreatureTemplate): Promise<void>
  deleteCreature(id: string): Promise<void>
  saveEncounter(value: EncounterTemplate): Promise<void>
  deleteEncounter(id: string): Promise<void>
  saveSession(value: CampaignSession): Promise<void>
  deleteSession(id: string): Promise<void>
  saveRecord(value: CampaignRecord): Promise<void>
  deleteRecord(id: string): Promise<void>
}

const newest = <T extends { updatedAt: string }>(items: T[]) =>
  [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

export const useCampaignStore = create<CampaignStore>()((set, get) => ({
  creatures: [],
  encounters: [],
  sessions: [],
  records: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return
    try {
      const [creatures, encounters, sessions, records] = await Promise.all([
        db.creatureTemplates.toArray(),
        db.encounters.toArray(),
        db.campaignSessions.toArray(),
        db.campaignRecords.toArray(),
      ])
      set((state) => ({
        creatures: newest([...creatures, ...state.creatures.filter((x) => !creatures.some((y) => y.id === x.id))]),
        encounters: newest([...encounters, ...state.encounters.filter((x) => !encounters.some((y) => y.id === x.id))]),
        sessions: newest([...sessions, ...state.sessions.filter((x) => !sessions.some((y) => y.id === x.id))]),
        records: newest([...records, ...state.records.filter((x) => !records.some((y) => y.id === x.id))]),
        loaded: true,
      }))
    } catch (err) {
      console.warn('Could not load campaign data', err)
      set({ loaded: true })
    }
  },

  saveCreature: async (value) => {
    await db.creatureTemplates.put(value)
    set((s) => ({ creatures: newest([...s.creatures.filter((x) => x.id !== value.id), value]) }))
  },
  deleteCreature: async (id) => {
    await db.creatureTemplates.delete(id)
    set((s) => ({ creatures: s.creatures.filter((x) => x.id !== id) }))
  },
  saveEncounter: async (value) => {
    await db.encounters.put(value)
    set((s) => ({ encounters: newest([...s.encounters.filter((x) => x.id !== value.id), value]) }))
  },
  deleteEncounter: async (id) => {
    await db.encounters.delete(id)
    set((s) => ({ encounters: s.encounters.filter((x) => x.id !== id) }))
  },
  saveSession: async (value) => {
    await db.campaignSessions.put(value)
    set((s) => ({ sessions: newest([...s.sessions.filter((x) => x.id !== value.id), value]) }))
  },
  deleteSession: async (id) => {
    await db.campaignSessions.delete(id)
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }))
  },
  saveRecord: async (value) => {
    await db.campaignRecords.put(value)
    set((s) => ({ records: newest([...s.records.filter((x) => x.id !== value.id), value]) }))
  },
  deleteRecord: async (id) => {
    await db.campaignRecords.delete(id)
    set((s) => ({ records: s.records.filter((x) => x.id !== id) }))
  },
}))
