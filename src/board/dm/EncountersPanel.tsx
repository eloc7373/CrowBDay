import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, inputClass } from '../../app/ui'
import { emptyCombat } from '../initiative/model'
import { useCombatStore } from '../initiative/store'
import { newId } from '../../lib/id'
import { useMapStore } from '../../mapcreator/store/mapStore'
import { mapExists, openMap } from '../../mapcreator/store/persistence'
import { useCampaignStore } from './store'
import type { EncounterMember, EncounterTemplate } from './types'

export function EncountersPanel() {
  const state = useCombatStore((s) => s.state)
  const updateCombat = useCombatStore((s) => s.update)
  const mapId = useMapStore((s) => s.doc.id)
  const encounters = useCampaignStore((s) => s.encounters)
  const load = useCampaignStore((s) => s.load)
  const saveEncounter = useCampaignStore((s) => s.saveEncounter)
  const deleteEncounter = useCampaignStore((s) => s.deleteEncounter)
  const navigate = useNavigate()
  const [name, setName] = useState('')

  useEffect(() => {
    void load()
  }, [load])

  const saveCurrent = () => {
    if (!name.trim() || !state.combatants.length) return
    const members: EncounterMember[] = state.combatants.map((combatant) => {
      const { id, order, ...member } = combatant
      void id
      void order
      return {
        ...member,
        hp: member.hp ? { ...member.hp } : null,
        conditions: [...member.conditions],
        effects: (member.effects ?? []).map((effect) => ({ ...effect })),
        link: member.link ? { ...member.link } : null,
      }
    })
    void saveEncounter({
      id: newId('encounter'),
      name: name.trim(),
      mapId,
      members,
      updatedAt: new Date().toISOString(),
    })
    setName('')
  }

  const start = (encounter: EncounterTemplate) => {
    if (state.combatants.length && !window.confirm('Replace the current initiative roster?')) return
    updateCombat(() => {
      const next = emptyCombat()
      const combatants = encounter.members.map((member, order) => ({
        ...member,
        id: newId('cbt'),
        order,
        initiative: null,
        hp: member.hp ? { ...member.hp, current: member.hp.max, temp: 0 } : null,
        conditions: [],
        exhaustion: 0,
        movedFt: 0,
        concentrating: false,
        effects: [],
        link: encounter.mapId === mapId ? member.link : null,
      }))
      return { ...next, combatants, nextOrder: combatants.length }
    })
  }

  const openEncounterMap = async (encounter: EncounterTemplate) => {
    if (!encounter.mapId) return
    if (encounter.mapId !== mapId && !(await mapExists(encounter.mapId))) {
      window.alert('The map associated with this encounter is no longer saved in this browser.')
      return
    }
    if (encounter.mapId !== mapId) await openMap(encounter.mapId)
    navigate('/map')
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-end gap-1">
        <label className="flex min-w-32 flex-1 flex-col gap-0.5">
          Save current initiative roster
          <input aria-label="Encounter name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Encounter name" />
        </label>
        <Button variant="primary" disabled={!name.trim() || !state.combatants.length} onClick={saveCurrent}>Save encounter</Button>
      </div>
      {!encounters.length ? (
        <p className="text-zinc-500">Saved encounters appear here. Loading one starts a fresh roster.</p>
      ) : (
        <ul aria-label="Saved encounters" className="flex flex-col gap-1">
          {encounters.map((encounter) => (
            <li key={encounter.id} className="flex flex-wrap items-center gap-1 rounded border border-zinc-200 p-2 dark:border-zinc-700">
              <span className="min-w-32 flex-1">
                <strong>{encounter.name}</strong>
                <span className="ml-1 text-zinc-500">{encounter.members.length} creatures{encounter.mapId ? ' · map linked' : ''}</span>
              </span>
              <Button onClick={() => start(encounter)}>Start fresh</Button>
              {encounter.mapId && <Button onClick={() => void openEncounterMap(encounter)}>Open map</Button>}
              <Button variant="ghost" onClick={() => window.confirm(`Delete ${encounter.name}?`) && void deleteEncounter(encounter.id)}>Delete</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
