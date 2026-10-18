import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, inputClass } from '../../app/ui'
import { newId } from '../../lib/id'
import { CREATURE_SIZES, type TokenHp } from '../../mapcreator/layers/model'
import { useEditorStore } from '../../mapcreator/store/editorStore'
import { addCombatant } from '../initiative/model'
import { useCombatStore } from '../initiative/store'
import { useCampaignStore } from './store'
import type { CreatureTemplate } from './types'

const TOKEN_FOR_SIDE = {
  pc: 'token-pc',
  ally: 'token-ally',
  enemy: 'token-monster',
  neutral: 'token-npc',
} as const

const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

export function CreatureTemplatesPanel() {
  const templates = useCampaignStore((s) => s.creatures)
  const load = useCampaignStore((s) => s.load)
  const saveCreature = useCampaignStore((s) => s.saveCreature)
  const deleteCreature = useCampaignStore((s) => s.deleteCreature)
  const updateCombat = useCombatStore((s) => s.update)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [side, setSide] = useState<CreatureTemplate['side']>('enemy')
  const [size, setSize] = useState<CreatureTemplate['size']>('medium')
  const [hp, setHp] = useState('')
  const [ac, setAc] = useState('')
  const [speed, setSpeed] = useState('30')
  const [dex, setDex] = useState('0')
  const [con, setCon] = useState('0')
  const [conditions, setConditions] = useState('')

  useEffect(() => {
    void load()
  }, [load])

  const create = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    const maxHp = numberOrNull(hp)
    const savedHp: TokenHp | null =
      maxHp === null ? null : { current: maxHp, max: maxHp, temp: 0 }
    void saveCreature({
      id: newId('creature'),
      name: name.trim(),
      side,
      size,
      hp: savedHp,
      ac: numberOrNull(ac),
      speed: numberOrNull(speed),
      initiativeBonus: Number(dex) || 0,
      dexMod: Number(dex) || 0,
      conMod: Number(con) || 0,
      conditions: conditions
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      updatedAt: new Date().toISOString(),
    })
    setName('')
  }

  const addToInitiative = (template: CreatureTemplate) => {
    updateCombat((state) =>
      addCombatant(state, {
        id: newId('cbt'),
        name: template.name,
        initiative: null,
        dexMod: template.dexMod,
        hp: template.hp ? { ...template.hp } : null,
        ac: template.ac,
        conditions: [...template.conditions],
        exhaustion: 0,
        side: template.side,
        speed: template.speed,
        conMod: template.conMod,
      }),
    )
  }

  const placeOnMap = (template: CreatureTemplate) => {
    useEditorStore.getState().set({
      tool: 'stamp',
      activeLayer: 'tokens',
      stampId: TOKEN_FOR_SIDE[template.side],
      tokenSize: template.size,
      pendingTokenTemplate: {
        name: template.name,
        side: template.side,
        size: template.size,
        hp: template.hp ? { ...template.hp } : null,
        ac: template.ac,
        speed: template.speed,
        initiativeBonus: template.initiativeBonus,
        conditions: [...template.conditions],
        hidden: false,
      },
    })
    navigate('/map')
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <form onSubmit={create} className="flex flex-col gap-1.5 rounded bg-zinc-50 p-2 dark:bg-zinc-800/50">
        <strong>New creature template</strong>
        <input
          aria-label="Template creature name"
          className={inputClass}
          placeholder="Creature name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="grid grid-cols-3 gap-1">
          <select aria-label="Template side" className={inputClass} value={side} onChange={(e) => setSide(e.target.value as CreatureTemplate['side'])}>
            <option value="pc">PC</option><option value="ally">Ally</option><option value="enemy">Enemy</option><option value="neutral">Neutral</option>
          </select>
          <select aria-label="Template size" className={inputClass} value={size} onChange={(e) => setSize(e.target.value as CreatureTemplate['size'])}>
            {CREATURE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <input aria-label="Template max HP" inputMode="numeric" className={inputClass} placeholder="Max HP" value={hp} onChange={(e) => setHp(e.target.value)} />
          <input aria-label="Template AC" inputMode="numeric" className={inputClass} placeholder="AC" value={ac} onChange={(e) => setAc(e.target.value)} />
          <input aria-label="Template speed" inputMode="numeric" className={inputClass} placeholder="Speed" value={speed} onChange={(e) => setSpeed(e.target.value)} />
          <input aria-label="Template Dex modifier" inputMode="numeric" className={inputClass} placeholder="Dex" value={dex} onChange={(e) => setDex(e.target.value)} />
          <input aria-label="Template Con modifier" inputMode="numeric" className={inputClass} placeholder="Con" value={con} onChange={(e) => setCon(e.target.value)} />
          <input aria-label="Template conditions" className={`${inputClass} col-span-2`} placeholder="Conditions, comma separated" value={conditions} onChange={(e) => setConditions(e.target.value)} />
        </div>
        <Button type="submit" variant="primary" disabled={!name.trim()}>Save template</Button>
      </form>
      {!templates.length && <p className="text-zinc-500">Save a creature above to reuse it on maps or in initiative.</p>}
      <ul className="flex flex-col gap-1" aria-label="Saved creature templates">
        {templates.map((template) => (
          <li key={template.id} className="rounded border border-zinc-200 p-2 dark:border-zinc-700">
            <div className="mb-1 flex items-center gap-2">
              <strong className="flex-1">{template.name}</strong>
              <span className="capitalize text-zinc-500">{template.side} · {template.size}{template.hp ? ` · ${template.hp.max} HP` : ''}{template.ac !== null ? ` · AC ${template.ac}` : ''}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button onClick={() => addToInitiative(template)}>Add to initiative</Button>
              <Button onClick={() => placeOnMap(template)}>Place on map</Button>
              <Button variant="ghost" onClick={() => window.confirm(`Delete ${template.name}?`) && void deleteCreature(template.id)}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
