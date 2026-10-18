import { Pencil, Plus, Swords, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, inputClass } from '../../app/ui'
import { newId } from '../../lib/id'
import { addCombatant } from '../initiative/model'
import { useCombatStore } from '../initiative/store'
import { useCampaignStore } from './store'
import type { AbilityKey, CampaignRecord, CharacterDetails, SkillKey } from './types'

const ABILITIES: { key: AbilityKey; label: string }[] = [
  { key: 'str', label: 'Strength' },
  { key: 'dex', label: 'Dexterity' },
  { key: 'con', label: 'Constitution' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom' },
  { key: 'cha', label: 'Charisma' },
]

const SKILLS: { key: SkillKey; label: string }[] = [
  { key: 'acrobatics', label: 'Acrobatics' },
  { key: 'animalHandling', label: 'Animal Handling' },
  { key: 'arcana', label: 'Arcana' },
  { key: 'athletics', label: 'Athletics' },
  { key: 'deception', label: 'Deception' },
  { key: 'history', label: 'History' },
  { key: 'insight', label: 'Insight' },
  { key: 'intimidation', label: 'Intimidation' },
  { key: 'investigation', label: 'Investigation' },
  { key: 'medicine', label: 'Medicine' },
  { key: 'nature', label: 'Nature' },
  { key: 'perception', label: 'Perception' },
  { key: 'performance', label: 'Performance' },
  { key: 'persuasion', label: 'Persuasion' },
  { key: 'religion', label: 'Religion' },
  { key: 'sleightOfHand', label: 'Sleight of Hand' },
  { key: 'stealth', label: 'Stealth' },
  { key: 'survival', label: 'Survival' },
]

const emptyDraft = () => ({
  name: '', playerName: '', species: '', className: '', level: '1', background: '', alignment: '',
  experience: '', proficiencyBonus: '', abilities: Object.fromEntries(ABILITIES.map(({ key }) => [key, ''])) as Record<AbilityKey, string>,
  savingThrowProficiencies: [] as AbilityKey[], skillProficiencies: [] as SkillKey[],
  currentHp: '', maxHp: '', tempHp: '', ac: '', speed: '30', dexMod: '0', initiativeBonus: '',
  hitDice: '', equipment: '', features: '', spells: '', notes: '',
})

type SheetDraft = ReturnType<typeof emptyDraft>

const parseOptionalNumber = (value: string): number | null => {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const modifier = (score: number | null | undefined) =>
  score == null ? '—' : `${Math.floor((score - 10) / 2) >= 0 ? '+' : ''}${Math.floor((score - 10) / 2)}`

function SheetField({
  label,
  value,
  onChange,
  type = 'text',
  min,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
  min?: number
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
      {label}
      <input className={inputClass} type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function makeDraft(record?: CampaignRecord): SheetDraft {
  const base = emptyDraft()
  if (!record) return base
  const character = record.character
  return {
    ...base,
    name: record.name,
    playerName: character?.playerName ?? '',
    species: character?.species ?? '',
    className: character?.className ?? '',
    level: character?.level?.toString() ?? '',
    background: character?.background ?? '',
    alignment: character?.alignment ?? '',
    experience: character?.experience?.toString() ?? '',
    proficiencyBonus: character?.proficiencyBonus?.toString() ?? '',
    abilities: Object.fromEntries(ABILITIES.map(({ key }) => [key, character?.abilities?.[key]?.toString() ?? ''])) as Record<AbilityKey, string>,
    savingThrowProficiencies: character?.savingThrowProficiencies ?? [],
    skillProficiencies: character?.skillProficiencies ?? [],
    currentHp: character?.currentHp?.toString() ?? '',
    maxHp: character?.maxHp?.toString() ?? '',
    tempHp: character?.tempHp?.toString() ?? '',
    ac: character?.ac?.toString() ?? '',
    speed: character?.speed?.toString() ?? '',
    dexMod: character?.dexMod?.toString() ?? '0',
    initiativeBonus: character?.initiativeBonus?.toString() ?? '',
    hitDice: character?.hitDice ?? '',
    equipment: character?.equipment ?? '',
    features: character?.features ?? '',
    spells: character?.spells ?? '',
    notes: record.details ?? '',
  }
}

export function PlayerSheetsPanel() {
  const allRecords = useCampaignStore((state) => state.records)
  const records = allRecords.filter((record) => record.type === 'party')
  const load = useCampaignStore((state) => state.load)
  const saveRecord = useCampaignStore((state) => state.saveRecord)
  const deleteRecord = useCampaignStore((state) => state.deleteRecord)
  const updateCombat = useCombatStore((state) => state.update)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SheetDraft>(emptyDraft)

  useEffect(() => {
    void load()
  }, [load])

  const change = <K extends keyof SheetDraft>(key: K, value: SheetDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim()) return
    const abilities = Object.fromEntries(
      ABILITIES.map(({ key }) => [key, parseOptionalNumber(draft.abilities[key])]),
    ) as CharacterDetails['abilities']
    const dexScore = abilities?.dex
    const character: CharacterDetails = {
      playerName: draft.playerName.trim(),
      species: draft.species.trim(),
      className: draft.className.trim(),
      level: parseOptionalNumber(draft.level),
      background: draft.background.trim(),
      alignment: draft.alignment.trim(),
      experience: parseOptionalNumber(draft.experience),
      proficiencyBonus: parseOptionalNumber(draft.proficiencyBonus),
      abilities,
      savingThrowProficiencies: [...draft.savingThrowProficiencies],
      skillProficiencies: [...draft.skillProficiencies],
      currentHp: parseOptionalNumber(draft.currentHp),
      maxHp: parseOptionalNumber(draft.maxHp),
      tempHp: parseOptionalNumber(draft.tempHp),
      ac: parseOptionalNumber(draft.ac),
      speed: parseOptionalNumber(draft.speed),
      dexMod: dexScore == null ? Number(draft.dexMod) || 0 : Math.floor((dexScore - 10) / 2),
      initiativeBonus: parseOptionalNumber(draft.initiativeBonus),
      hitDice: draft.hitDice.trim(),
      equipment: draft.equipment.trim(),
      features: draft.features.trim(),
      spells: draft.spells.trim(),
    }
    const previous = records.find((record) => record.id === editingId)
    void saveRecord({
      id: editingId ?? newId('party'),
      type: 'party',
      name: draft.name.trim(),
      details: draft.notes,
      status: previous?.status ?? 'Active',
      holder: '',
      origin: '',
      tags: previous?.tags ?? [],
      character,
      updatedAt: new Date().toISOString(),
    })
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const edit = (record: CampaignRecord) => {
    setEditingId(record.id)
    setDraft(makeDraft(record))
  }

  const addToCombat = (record: CampaignRecord) => {
    const character = record.character
    const dexMod = character?.abilities?.dex == null
      ? character?.dexMod ?? 0
      : Math.floor((character.abilities.dex - 10) / 2)
    const maxHp = character?.maxHp ?? null
    updateCombat((state) => addCombatant(state, {
      id: newId('cbt'),
      name: record.name,
      initiative: null,
      dexMod,
      hp: maxHp === null ? null : {
        current: character?.currentHp ?? maxHp,
        max: maxHp,
        temp: character?.tempHp ?? 0,
      },
      ac: character?.ac ?? null,
      conditions: [],
      exhaustion: 0,
      side: 'pc',
      speed: character?.speed ?? null,
    }))
  }

  const toggleArray = <T extends string>(key: 'savingThrowProficiencies' | 'skillProficiencies', value: T) => {
    const selected = draft[key] as T[]
    change(key, (selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]) as SheetDraft[typeof key])
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <form onSubmit={save} className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/20">
        <div className="mb-3 flex items-center gap-2 border-b border-amber-200 pb-2 dark:border-amber-900">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"><UserRound size={16} /></span>
          <div className="flex-1"><h3 className="font-semibold">{editingId ? 'Edit player character' : 'New player character'}</h3><p className="text-[10px] text-zinc-500">Fill in what you use at your table; all fields are optional except the character name.</p></div>
          {editingId && <Button className="!px-2 !py-1 text-xs" onClick={() => { setEditingId(null); setDraft(emptyDraft()) }}>Cancel</Button>}
        </div>

        <fieldset className="mb-2 grid grid-cols-2 gap-2 rounded-md border border-zinc-200 bg-white/70 p-2 dark:border-zinc-700 dark:bg-zinc-900/50 md:grid-cols-4">
          <legend className="px-1 font-semibold text-amber-800 dark:text-amber-300">Identity</legend>
          <SheetField label="Character name *" value={draft.name} onChange={(value) => change('name', value)} />
          <SheetField label="Player name" value={draft.playerName} onChange={(value) => change('playerName', value)} />
          <SheetField label="Species" value={draft.species} onChange={(value) => change('species', value)} />
          <SheetField label="Class / subclass" value={draft.className} onChange={(value) => change('className', value)} />
          <SheetField label="Level" type="number" min={1} value={draft.level} onChange={(value) => change('level', value)} />
          <SheetField label="Background" value={draft.background} onChange={(value) => change('background', value)} />
          <SheetField label="Alignment" value={draft.alignment} onChange={(value) => change('alignment', value)} />
          <SheetField label="Experience points" type="number" min={0} value={draft.experience} onChange={(value) => change('experience', value)} />
        </fieldset>

        <fieldset className="mb-2 rounded-md border border-zinc-200 bg-white/70 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
          <legend className="px-1 font-semibold text-amber-800 dark:text-amber-300">Ability scores</legend>
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-6">
            {ABILITIES.map(({ key, label }) => {
              const score = parseOptionalNumber(draft.abilities[key])
              return <label key={key} className="flex flex-col items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1.5 dark:border-zinc-700 dark:bg-zinc-800"><span className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">{label.slice(0, 3)}</span><input aria-label={`${label} score`} className="w-full rounded border border-zinc-300 bg-white px-1 py-1 text-center text-sm font-bold dark:border-zinc-600 dark:bg-zinc-900" type="number" min={1} max={30} value={draft.abilities[key]} onChange={(event) => change('abilities', { ...draft.abilities, [key]: event.target.value })} /><span className="font-mono text-[10px] text-amber-800 dark:text-amber-300">Modifier {modifier(score)}</span></label>
            })}
          </div>
        </fieldset>

        <fieldset className="mb-2 grid grid-cols-3 gap-2 rounded-md border border-zinc-200 bg-white/70 p-2 dark:border-zinc-700 dark:bg-zinc-900/50 md:grid-cols-6">
          <legend className="px-1 font-semibold text-amber-800 dark:text-amber-300">Combat & resources</legend>
          <SheetField label="Current HP" type="number" min={0} value={draft.currentHp} onChange={(value) => change('currentHp', value)} />
          <SheetField label="Max HP" type="number" min={0} value={draft.maxHp} onChange={(value) => change('maxHp', value)} />
          <SheetField label="Temp HP" type="number" min={0} value={draft.tempHp} onChange={(value) => change('tempHp', value)} />
          <SheetField label="Armor class" type="number" min={0} value={draft.ac} onChange={(value) => change('ac', value)} />
          <SheetField label="Speed" type="number" min={0} value={draft.speed} onChange={(value) => change('speed', value)} />
          <SheetField label="Proficiency bonus" type="number" min={0} value={draft.proficiencyBonus} onChange={(value) => change('proficiencyBonus', value)} />
          <SheetField label="Initiative bonus" type="number" value={draft.initiativeBonus} onChange={(value) => change('initiativeBonus', value)} />
          {draft.abilities.dex === '' && <SheetField label="Dexterity modifier" type="number" value={draft.dexMod} onChange={(value) => change('dexMod', value)} />}
          <SheetField label="Hit dice" value={draft.hitDice} onChange={(value) => change('hitDice', value)} />
        </fieldset>

        <fieldset className="mb-2 rounded-md border border-zinc-200 bg-white/70 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
          <legend className="px-1 font-semibold text-amber-800 dark:text-amber-300">Proficiencies</legend>
          <div className="mb-2 grid grid-cols-3 gap-1 sm:grid-cols-6">
            {ABILITIES.map(({ key, label }) => <label key={key} className="flex items-center gap-1 rounded bg-zinc-50 px-1.5 py-1 dark:bg-zinc-800"><input type="checkbox" checked={draft.savingThrowProficiencies.includes(key)} onChange={() => toggleArray('savingThrowProficiencies', key)} /> <span>{label.slice(0, 3)} save</span></label>)}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3 md:grid-cols-6">
            {SKILLS.map(({ key, label }) => <label key={key} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><input type="checkbox" checked={draft.skillProficiencies.includes(key)} onChange={() => toggleArray('skillProficiencies', key)} /> {label}</label>)}
          </div>
        </fieldset>

        <div className="mb-2 grid gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Features & traits<textarea className={inputClass} rows={3} value={draft.features} onChange={(event) => change('features', event.target.value)} placeholder="Class features, feats, traits…" /></label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Equipment & treasure<textarea className={inputClass} rows={3} value={draft.equipment} onChange={(event) => change('equipment', event.target.value)} placeholder="Weapons, armor, items…" /></label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Spells & slots<textarea className={inputClass} rows={3} value={draft.spells} onChange={(event) => change('spells', event.target.value)} placeholder="Known spells, prepared spells, slots…" /></label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Notes<textarea className={inputClass} rows={3} value={draft.notes} onChange={(event) => change('notes', event.target.value)} placeholder="Personality, bonds, goals, reminders…" /></label>
        </div>
        <Button type="submit" variant="primary" disabled={!draft.name.trim()}><Plus size={14} /> {editingId ? 'Save character sheet' : 'Save player character'}</Button>
      </form>

      <div className="flex flex-col gap-1" aria-label="Saved player characters">
        {records.map((record) => {
          const character = record.character
          return <article key={record.id} className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100 font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{record.name.slice(0, 1).toUpperCase()}</span><div className="min-w-24 flex-1"><strong>{record.name}</strong><p className="text-[10px] text-zinc-500">{[character?.playerName, character?.species, character?.className, character?.level != null && `Level ${character.level}`].filter(Boolean).join(' · ') || record.details}</p></div><Button className="!px-2 !py-1 text-xs" onClick={() => edit(record)}><Pencil size={12} /> Edit</Button><Button variant="primary" className="!px-2 !py-1 text-xs" onClick={() => addToCombat(record)}><Swords size={12} /> Add to initiative</Button><Button variant="ghost" className="!px-1.5 !py-1 text-red-600" aria-label={`Delete ${record.name}`} onClick={() => window.confirm(`Delete ${record.name}?`) && void deleteRecord(record.id)}><Trash2 size={13} /></Button></div>
            {character && <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-6">{ABILITIES.map(({ key, label }) => <div key={key} className="rounded bg-zinc-50 px-2 py-1 text-center dark:bg-zinc-800"><span className="text-[9px] uppercase text-zinc-500">{label.slice(0, 3)}</span><b className="ml-1">{character.abilities?.[key] ?? '—'}</b><span className="ml-1 font-mono text-[9px] text-amber-700">{modifier(character.abilities?.[key])}</span></div>)}</div>}
            {character && <p className="mt-1 text-[10px] text-zinc-500">HP {character.currentHp ?? '—'}/{character.maxHp ?? '—'} · Temp {character.tempHp ?? 0} · AC {character.ac ?? '—'} · Speed {character.speed ?? '—'} ft</p>}
          </article>
        })}
        {!records.length && <p className="py-3 text-center text-zinc-500">Saved player sheets will appear here.</p>}
      </div>
    </div>
  )
}
