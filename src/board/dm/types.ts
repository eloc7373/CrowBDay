import type { Combatant, Side } from '../initiative/model'
import type { CreatureSize, TokenHp } from '../../mapcreator/layers/model'

export interface CreatureTemplate {
  id: string
  name: string
  side: Side
  size: CreatureSize
  hp: TokenHp | null
  ac: number | null
  speed: number | null
  initiativeBonus: number | null
  dexMod: number
  conMod: number
  conditions: string[]
  updatedAt: string
}

export type EncounterMember = Omit<Combatant, 'id' | 'order'>

export interface EncounterTemplate {
  id: string
  name: string
  mapId: string | null
  members: EncounterMember[]
  updatedAt: string
}

export type CampaignLinkKind = 'note' | 'room' | 'party' | 'quest' | 'loot' | 'encounter'

export interface CampaignLink {
  kind: CampaignLinkKind
  id: string
  label: string
  mapId?: string
}

export interface CampaignSession {
  id: string
  date: string
  title: string
  recap: string
  decisions: string
  openThreads: string
  links: CampaignLink[]
  createdAt: string
  updatedAt: string
}

export type CampaignRecordKind = 'party' | 'quest' | 'loot'

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export type SkillKey =
  | 'acrobatics'
  | 'animalHandling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleightOfHand'
  | 'stealth'
  | 'survival'

export interface CharacterDetails {
  playerName: string
  species?: string
  className: string
  level: number | null
  background?: string
  alignment?: string
  experience?: number | null
  proficiencyBonus?: number | null
  abilities?: Partial<Record<AbilityKey, number | null>>
  savingThrowProficiencies?: AbilityKey[]
  skillProficiencies?: SkillKey[]
  currentHp?: number | null
  maxHp: number | null
  tempHp?: number | null
  ac: number | null
  speed: number | null
  dexMod: number
  initiativeBonus?: number | null
  hitDice?: string
  equipment?: string
  features?: string
  spells?: string
}

export interface CampaignRecord {
  id: string
  type: CampaignRecordKind
  name: string
  details: string
  status: string
  holder: string
  origin: string
  tags: string[]
  character?: CharacterDetails
  updatedAt: string
}
