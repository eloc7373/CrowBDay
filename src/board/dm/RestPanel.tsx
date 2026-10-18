import { useMemo, useState } from 'react'
import { Button } from '../../app/ui'
import { restRecovery, type RestResetOptions } from '../../combat/actions'
import { sortedCombatants } from '../initiative/model'
import { useCombatStore } from '../initiative/store'

const SHORT_REST: RestResetOptions = {
  restoreHp: false,
  clearTempHp: false,
  clearConditions: false,
  clearExhaustion: false,
  clearTimedEffects: true,
  endConcentration: false,
  resetMovement: true,
}
const LONG_REST: RestResetOptions = {
  restoreHp: true,
  clearTempHp: true,
  clearConditions: false,
  clearExhaustion: false,
  clearTimedEffects: true,
  endConcentration: false,
  resetMovement: true,
}
const OPTIONS: { key: keyof RestResetOptions; label: string }[] = [
  { key: 'restoreHp', label: 'Restore HP to maximum' },
  { key: 'clearTempHp', label: 'Clear temporary HP' },
  { key: 'clearConditions', label: 'Clear all conditions' },
  { key: 'clearExhaustion', label: 'Clear exhaustion' },
  { key: 'clearTimedEffects', label: 'Remove timed effects (keep indefinite effects)' },
  { key: 'endConcentration', label: 'End concentration' },
  { key: 'resetMovement', label: 'Reset movement' },
]

export function RestPanel() {
  const combatants = useCombatStore((s) => s.state.combatants)
  const update = useCombatStore((s) => s.update)
  const [rest, setRest] = useState<'short' | 'long'>('short')
  const [options, setOptions] = useState<RestResetOptions>(SHORT_REST)
  const [selected, setSelected] = useState<string[]>([])
  const ids = useMemo(() => selected.length ? selected : combatants.map((c) => c.id), [selected, combatants])

  const setRestType = (value: 'short' | 'long') => {
    setRest(value)
    setOptions(value === 'short' ? SHORT_REST : LONG_REST)
  }

  return <div className="flex flex-col gap-2 text-xs">
    <div className="flex items-center gap-2"><label className="flex flex-1 flex-col gap-1">Rest type<select className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800" value={rest} onChange={(event) => setRestType(event.target.value as 'short' | 'long')}><option value="short">Short rest</option><option value="long">Long rest</option></select></label><Button variant="primary" disabled={!combatants.length} onClick={() => update((state) => restRecovery(state, ids, rest, options))}>Apply to {ids.length} {ids.length === 1 ? 'creature' : 'creatures'}</Button></div>
    <p className="text-zinc-500">A DM-controlled checklist—rest rules vary by edition and table. One undo reverses the entire recovery.</p>
    <fieldset className="flex flex-col gap-1 rounded border border-zinc-200 p-2 dark:border-zinc-700"><legend className="px-1 font-medium">Recovery choices</legend>{OPTIONS.map(({ key, label }) => <label key={key} className="flex items-start gap-2"><input type="checkbox" checked={options[key]} onChange={(event) => setOptions({ ...options, [key]: event.target.checked })} /><span>{label}</span></label>)}</fieldset>
    {combatants.length > 0 && <fieldset className="flex flex-col gap-1 rounded border border-zinc-200 p-2 dark:border-zinc-700"><legend className="px-1 font-medium">Creatures (none selected means everyone)</legend>{sortedCombatants(combatants).map((creature) => <label key={creature.id} className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(creature.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, creature.id] : selected.filter((id) => id !== creature.id))} /><span className="flex-1">{creature.name}</span>{creature.hp && <span className="font-mono">{creature.hp.current}/{creature.hp.max} HP</span>}</label>)}</fieldset>}
    {!combatants.length && <p className="py-4 text-center text-zinc-500">Add creatures to initiative to apply a rest.</p>}
  </div>
}
