import { create } from 'zustand'
import { db, type CompendiumMonster, type CompendiumOption, type SavedCompendiumPack } from '../../lib/db'
import { newId } from '../../lib/id'

export interface CompendiumImportResult {
  monsters: CompendiumMonster[]
  options: CompendiumOption[]
  errors: string[]
  name?: string
  notice?: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const string = (value: unknown): value is string => typeof value === 'string'
const optionalString = (value: unknown) => (string(value) ? value.trim() : undefined)
const textArray = (value: unknown) => Array.isArray(value) && value.every(string)
const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

export function validateCompendium(input: unknown): CompendiumImportResult {
  if (!isObject(input)) return { monsters: [], options: [], errors: ['Expected a JSON object.'] }
  const errors: string[] = []
  const monsters: CompendiumMonster[] = []
  const options: CompendiumOption[] = []
  const name = optionalString(input.name)
  const notice = optionalString(input.notice)
  if (!Array.isArray(input.monsters) && !Array.isArray(input.options)) {
    return { monsters, options, errors: ['Add a "monsters" or "options" array.'], name, notice }
  }
  for (const [index, item] of (Array.isArray(input.monsters) ? input.monsters : []).entries()) {
    const where = `monsters[${index}]`
    if (!isObject(item) || !string(item.name) || !Number.isFinite(item.ac) || !Number.isFinite(item.hp)) {
      errors.push(`${where}: name, numeric ac, and numeric hp are required.`)
      continue
    }
    const traits = item.traits === undefined ? [] : item.traits
    if (!Array.isArray(traits) || !traits.every(string)) {
      errors.push(`${where}: traits must be an array of strings.`)
      continue
    }
    const textFields = ['savingThrows', 'skills', 'senses', 'languages', 'damageVulnerabilities', 'damageResistances', 'damageImmunities', 'conditionImmunities', 'actions', 'bonusActions', 'reactions', 'legendaryActions'] as const
    const invalidTextField = textFields.find((field) => item[field] !== undefined && !textArray(item[field]))
    if (invalidTextField) {
      errors.push(`${where}: ${invalidTextField} must be an array of strings.`)
      continue
    }
    const abilities = item.abilityScores
    if (abilities !== undefined && (!isObject(abilities) || abilityKeys.some((key) => abilities[key] !== undefined && !Number.isFinite(abilities[key])))) {
      errors.push(`${where}: abilityScores must contain numeric ability scores.`)
      continue
    }
    if (item.imageUrl !== undefined && !string(item.imageUrl)) {
      errors.push(`${where}: imageUrl must be a string.`)
      continue
    }
    monsters.push({
      id: `${newId('monster')}-${index}`,
      name: item.name.trim(),
      size: optionalString(item.size), type: optionalString(item.type),
      ac: Number(item.ac), hp: Number(item.hp), speed: optionalString(item.speed),
      initiativeBonus: Number.isFinite(item.initiativeBonus) ? Number(item.initiativeBonus) : undefined,
      initiativeScore: Number.isFinite(item.initiativeScore) ? Number(item.initiativeScore) : undefined,
      dexMod: Number.isFinite(item.dexMod)
        ? Number(item.dexMod)
        : isObject(abilities) && Number.isFinite(abilities.dex) ? Math.floor((Number(abilities.dex) - 10) / 2) : 0,
      conMod: Number.isFinite(item.conMod) ? Number(item.conMod) : undefined,
      abilityScores: isObject(abilities) ? Object.fromEntries(abilityKeys.flatMap((key) => Number.isFinite(abilities[key]) ? [[key, Number(abilities[key])]] : [])) : undefined,
      challenge: optionalString(item.challenge), summary: optionalString(item.summary),
      traits: traits.map((trait) => trait.trim()).filter(Boolean), source: optionalString(item.source),
      alignment: optionalString(item.alignment), legendary: typeof item.legendary === 'boolean' ? item.legendary : undefined,
      savingThrows: item.savingThrows as string[] | undefined,
      skills: item.skills as string[] | undefined,
      senses: item.senses as string[] | undefined,
      languages: item.languages as string[] | undefined,
      damageVulnerabilities: item.damageVulnerabilities as string[] | undefined,
      damageResistances: item.damageResistances as string[] | undefined,
      damageImmunities: item.damageImmunities as string[] | undefined,
      conditionImmunities: item.conditionImmunities as string[] | undefined,
      actions: item.actions as string[] | undefined,
      bonusActions: item.bonusActions as string[] | undefined,
      reactions: item.reactions as string[] | undefined,
      legendaryActions: item.legendaryActions as string[] | undefined,
      imageUrl: optionalString(item.imageUrl),
      imageUrls: textArray(item.imageUrls) ? (item.imageUrls as string[]) : undefined,
      imagePages: Array.isArray(item.imagePages) && item.imagePages.every((page) => Number.isFinite(page)) ? (item.imagePages as number[]) : undefined,
      hpFormula: optionalString(item.hpFormula), xp: optionalString(item.xp), gear: optionalString(item.gear),
      proficiencyBonus: Number.isFinite(item.proficiencyBonus) ? Number(item.proficiencyBonus) : undefined,
      imagePage: Number.isFinite(item.imagePage) ? Number(item.imagePage) : undefined,
      imageEdition: optionalString(item.imageEdition),
      imageMatch: optionalString(item.imageMatch),
      bookPage: Number.isFinite(item.bookPage) ? Number(item.bookPage) : undefined,
      sourceUrl: optionalString(item.sourceUrl) ?? optionalString(item.referenceUrl),
    })
  }
  for (const [index, item] of (Array.isArray(input.options) ? input.options : []).entries()) {
    const where = `options[${index}]`
    if (!isObject(item) || !string(item.name) || !string(item.category) || !string(item.summary) || !string(item.description)) {
      errors.push(`${where}: name, category, summary, and description are required.`)
      continue
    }
    options.push({
      id: `${newId('option')}-${index}`,
      name: item.name.trim(), category: item.category.trim(), summary: item.summary.trim(),
      description: item.description.trim(), source: optionalString(item.source),
    })
  }
  if (!monsters.length && !options.length && !errors.length) errors.push('No monster or player option entries found.')
  return { monsters, options, errors, name, notice }
}

const bundledPackId = 'monster-manual-2024'
const retiredPackIds = ['aidedd-legacy-5e-monsters']

interface CompendiumState {
  packs: SavedCompendiumPack[]
  loaded: boolean
  load(): Promise<void>
  importPack(input: unknown, fallbackName: string): Promise<CompendiumImportResult>
  removePack(id: string): Promise<void>
}

export const useCompendiumStore = create<CompendiumState>()((set, get) => ({
  packs: [], loaded: false,
  load: async () => {
    if (get().loaded) return
    try {
      await db.compendiumPacks.bulkDelete(retiredPackIds)
      const existing = await db.compendiumPacks.get(bundledPackId)
      if (!existing) {
        const response = await fetch('/monster-manual-compendium.json')
        if (!response.ok) throw new Error(`Could not load bundled compendium (${response.status}).`)
        const result = validateCompendium(await response.json())
        if (result.monsters.length) {
          await db.compendiumPacks.put({
            id: bundledPackId,
            name: result.name ?? 'Monster Manual (2024)',
            notice: result.notice,
            monsters: result.monsters,
            options: result.options,
          })
        }
      }
      set({ packs: await db.compendiumPacks.toArray(), loaded: true })
    } catch (error) {
      console.warn('Could not load compendium', error)
      set({ packs: await db.compendiumPacks.toArray().catch(() => []), loaded: true })
    }
  },
  importPack: async (input, fallbackName) => {
    const result = validateCompendium(input)
    if (!result.monsters.length && !result.options.length) return result
    const pack: SavedCompendiumPack = {
      id: newId('compendium'), name: result.name ?? fallbackName,
      notice: result.notice,
      monsters: result.monsters, options: result.options,
    }
    await db.compendiumPacks.put(pack)
    set({ packs: [...get().packs, pack] })
    return result
  },
  removePack: async (id) => {
    await db.compendiumPacks.delete(id)
    set({ packs: get().packs.filter((pack) => pack.id !== id) })
  },
}))
