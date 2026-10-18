import Dexie, { type Table } from 'dexie'
import type { CombatState } from '../board/initiative/model'
import type { RuleEntry } from '../board/rules/types'
import type { MapDoc } from '../mapcreator/layers/model'
import type { TilesetFile } from '../mapcreator/tilesets/tilesetFormat'
import type {
  CampaignRecord,
  CampaignSession,
  CreatureTemplate,
  EncounterTemplate,
} from '../board/dm/types'

export interface SavedMap {
  id: string
  name: string
  updatedAt: string
  doc: MapDoc
}

export interface Setting {
  key: string
  value: unknown
}

export interface SavedTileset {
  id: string
  name: string
  file: TilesetFile
  image: Blob
  installedAt: string
}

export interface SavedRulesPack {
  id: string
  name: string
  notice?: string
  entries: RuleEntry[]
}

export interface CompendiumMonster {
  id: string
  name: string
  size?: string
  type?: string
  ac: number
  hp: number
  /** Dice expression behind the average hp, e.g. "20d10 + 40". */
  hpFormula?: string
  speed?: string
  /** Initiative bonus printed in the stat block; falls back to Dexterity modifier. */
  initiativeBonus?: number
  initiativeScore?: number
  dexMod: number
  conMod?: number
  abilityScores?: {
    str?: number
    dex?: number
    con?: number
    int?: number
    wis?: number
    cha?: number
  }
  challenge?: string
  xp?: string
  proficiencyBonus?: number
  gear?: string
  alignment?: string
  legendary?: boolean
  savingThrows?: string[]
  skills?: string[]
  senses?: string[]
  languages?: string[]
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]
  summary?: string
  traits?: string[]
  actions?: string[]
  bonusActions?: string[]
  reactions?: string[]
  legendaryActions?: string[]
  imageUrl?: string
  /** Every book page the stat block occupies, in order. */
  imageUrls?: string[]
  imagePage?: number
  imagePages?: number[]
  imageEdition?: string
  imageMatch?: string
  bookPage?: number
  sourceUrl?: string
  source?: string
}

export interface CompendiumOption {
  id: string
  name: string
  category: string
  summary: string
  description: string
  source?: string
}

export interface SavedCompendiumPack {
  id: string
  name: string
  notice?: string
  monsters: CompendiumMonster[]
  options: CompendiumOption[]
}

export interface SavedCombat {
  id: 'current'
  state: CombatState
}

export interface SessionNote {
  id: string
  title: string
  /** Markdown. */
  body: string
  tags: string[]
  /** 1 = pinned, 0 = not (numbers so Dexie can index it). */
  pinned: 0 | 1
  createdAt: string
  updatedAt: string
}

export type { CampaignRecord, CampaignSession, CreatureTemplate, EncounterTemplate }

/** Local-only IndexedDB storage. Later phases add tables via new versions. */
class DmDatabase extends Dexie {
  maps!: Table<SavedMap, string>
  settings!: Table<Setting, string>
  tilesets!: Table<SavedTileset, string>
  rulePacks!: Table<SavedRulesPack, string>
  combat!: Table<SavedCombat, string>
  sessionNotes!: Table<SessionNote, string>
  creatureTemplates!: Table<CreatureTemplate, string>
  encounters!: Table<EncounterTemplate, string>
  campaignSessions!: Table<CampaignSession, string>
  campaignRecords!: Table<CampaignRecord, string>
  compendiumPacks!: Table<SavedCompendiumPack, string>

  constructor() {
    super('dm-toolkit')
    this.version(1).stores({
      maps: 'id, name, updatedAt',
      settings: 'key',
    })
    this.version(2).stores({
      tilesets: 'id, name',
    })
    this.version(3).stores({
      rulePacks: 'id, name',
      combat: 'id',
      sessionNotes: 'id, updatedAt, pinned, *tags',
    })
    this.version(4).stores({
      creatureTemplates: 'id, name, side, updatedAt',
      encounters: 'id, name, mapId, updatedAt',
      campaignSessions: 'id, date, title, updatedAt',
      campaignRecords: 'id, type, name, status, *tags, updatedAt',
    })
    this.version(5).stores({ compendiumPacks: 'id, name' })
  }
}

export const db = new DmDatabase()
