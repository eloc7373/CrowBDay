// Combat Mode building blocks shared by the DM Board cards and the Map Creator
// sidebar. All of them read and write the one combat store.

import { Undo2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, inputClass } from '../../app/ui'
import { type Combatant, type ConcentrationPrompt } from '../../board/initiative/model'
import { useCombatStore } from '../../board/initiative/store'
import { damageMany, dismissReminder, recordCombatNote, resolveConcentration, undoLast } from '../actions'

/** Start/end-of-turn prompts and expired effects. */
export function Reminders() {
  const reminders = useCombatStore((s) => s.state.reminders)
  const update = useCombatStore((s) => s.update)
  if (!reminders.length) return null
  return (
    <ul
      aria-label="Turn reminders"
      className="mb-2 flex flex-col gap-1 rounded-md border border-sky-300 bg-sky-50 p-1.5 text-xs dark:border-sky-700 dark:bg-sky-950"
    >
      {reminders.map((r) => (
        <li key={r.id} className="flex items-center gap-1" data-testid="reminder">
          <span className="flex-1">{r.text}</span>
          <button
            type="button"
            aria-label="Dismiss reminder"
            className="rounded p-0.5 hover:bg-sky-200 dark:hover:bg-sky-900"
            onClick={() => update((s) => dismissReminder(s, r.id))}
          >
            <X size={12} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

function Prompt({ p, c }: { p: ConcentrationPrompt; c: Combatant }) {
  const update = useCombatStore((s) => s.update)
  const mod = c.conMod ?? 0
  return (
    <li
      data-testid="concentration-prompt"
      className="flex flex-wrap items-center gap-1 rounded-md border border-violet-300 bg-violet-50 p-1.5 text-xs dark:border-violet-700 dark:bg-violet-950"
    >
      <span className="flex-1">
        <strong>{c.name}</strong> is concentrating: Constitution save, DC {p.dc}
        {mod ? ` (CON ${mod >= 0 ? '+' : ''}${mod})` : ''}
      </span>
      <Button
        className="!px-1.5 !py-0.5 text-xs"
        onClick={() => update((s) => resolveConcentration(s, p.id, true))}
      >
        Passed
      </Button>
      <Button
        className="!px-1.5 !py-0.5 text-xs"
        onClick={() => update((s) => resolveConcentration(s, p.id, false))}
      >
        Failed
      </Button>
    </li>
  )
}

/** Concentration saves waiting to be resolved (DC = max(10, half the damage)). */
export function ConcentrationPrompts() {
  const state = useCombatStore((s) => s.state)
  const items = state.concentrationPrompts
    .map((p) => ({ p, c: state.combatants.find((c) => c.id === p.combatantId) }))
    .filter((x): x is { p: ConcentrationPrompt; c: Combatant } => !!x.c)
  if (!items.length) return null
  return (
    <ul aria-label="Concentration checks" className="mb-2 flex flex-col gap-1">
      {items.map(({ p, c }) => (
        <Prompt key={p.id} p={p} c={c} />
      ))}
    </ul>
  )
}

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
type Ability = (typeof ABILITIES)[number]

/**
 * Damage several creatures at once, with an optional saving throw rolled for the
 * whole group: those who save take half (rounded down). One undo step.
 */
export function AreaEffect({
  candidates,
  emptyHint,
}: {
  candidates: Combatant[]
  emptyHint: string
}) {
  const update = useCombatStore((s) => s.update)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [useSave, setUseSave] = useState(true)
  const [ability, setAbility] = useState<Ability>('DEX')
  const [dc, setDc] = useState('15')
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const chosen = candidates.filter((c) => !skipped.has(c.id))
  const dmg = Math.max(0, Math.round(Number(amount)) || 0)
  const passed = (id: string) => saved[id] === true
  const toggleSaved = (id: string) =>
    setSaved((current) => ({ ...current, [id]: !current[id] }))

  const apply = () => {
    if (!dmg || !chosen.length) return
    const label = name.trim() || 'Area damage'
    update((s) =>
      damageMany(
        s,
        chosen.map((c) => ({ id: c.id, amount: dmg, half: useSave && passed(c.id) })),
        label,
      ),
    )
    setSaved({})
  }

  if (!candidates.length) {
    return <p className="text-xs text-zinc-500">{emptyHint}</p>
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs" data-testid="area-effect">
      <div className="grid grid-cols-3 gap-1">
        <label className="col-span-2 flex flex-col gap-0.5">
          Effect name
          <input
            aria-label="Effect name"
            className={inputClass}
            value={name}
            placeholder="Fireball"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Damage
          <input
            aria-label="Damage amount"
            className={inputClass}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
      </div>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={useSave} onChange={(e) => setUseSave(e.target.checked)} />
        Half damage on a successful save
      </label>
      {useSave && (
        <div className="grid grid-cols-4 items-end gap-1">
          <label className="flex flex-col gap-0.5">
            Save
            <select
              aria-label="Save ability"
              className={inputClass}
              value={ability}
              onChange={(e) => setAbility(e.target.value as Ability)}
            >
              {ABILITIES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            DC
            <input
              aria-label="Save DC"
              className={inputClass}
              inputMode="numeric"
              value={dc}
              onChange={(e) => setDc(e.target.value)}
            />
          </label>
          <p className="col-span-2 self-end pb-1 text-[11px] text-zinc-500">Roll externally; mark successful saves below.</p>
        </div>
      )}
      <ul aria-label="Targets" className="flex flex-col gap-0.5">
        {candidates.map((c) => {
          return (
            <li key={c.id} className="flex items-center gap-1.5" data-testid="area-target">
              <input
                type="checkbox"
                aria-label={`Include ${c.name}`}
                checked={!skipped.has(c.id)}
                onChange={(e) =>
                  setSkipped((s) => {
                    const n = new Set(s)
                    if (e.target.checked) n.delete(c.id)
                    else n.add(c.id)
                    return n
                  })
                }
              />
              <span className="flex-1 truncate">{c.name}</span>
              {c.hp && (
                <span className="font-mono text-zinc-500">
                  {c.hp.current}/{c.hp.max}
                </span>
              )}
              {useSave && (
                <>
                  <label className="flex items-center gap-0.5">
                    <input
                      type="checkbox"
                      aria-label={`${c.name} saved`}
                      checked={passed(c.id)}
                      onChange={() => toggleSaved(c.id)}
                    />
                    Saved
                  </label>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex gap-1">
        <Button
          variant="primary"
          className="!px-2 !py-0.5 text-xs"
          onClick={apply}
          disabled={!dmg || !chosen.length}
        >
          Apply damage
        </Button>
      </div>
    </div>
  )
}

/** Everything that happened this combat, newest first, with undo. */
export function CombatLog() {
  const log = useCombatStore((s) => s.state.log)
  const update = useCombatStore((s) => s.update)
  const [entry, setEntry] = useState('')
  const undoable = log.some((e) => e.before)
  const addEntry = (event: FormEvent) => {
    event.preventDefault()
    if (!entry.trim()) return
    update((current) => recordCombatNote(current, entry))
    setEntry('')
  }
  return (
    <div className="flex h-full flex-col gap-1 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500">{log.length} entries</span>
        <Button
          className="!px-2 !py-0.5 text-xs"
          disabled={!undoable}
          onClick={() => update(undoLast)}
          aria-label="Undo last combat action"
        >
          <Undo2 size={12} aria-hidden /> Undo last
        </Button>
      </div>
      <form className="flex gap-1" onSubmit={addEntry}>
        <input aria-label="Combat move or action" className={inputClass} placeholder="Record a move / action (dice rolled outside app)" value={entry} onChange={(event) => setEntry(event.target.value)} />
        <Button type="submit" variant="primary" className="!px-2" disabled={!entry.trim()}>Add</Button>
      </form>
      {log.length === 0 ? (
        <p className="py-3 text-center text-zinc-500">
          Turns, damage, healing, conditions, movement and your action notes are listed here.
        </p>
      ) : (
        <ol aria-label="Combat log" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {log.map((e) => (
            <li
              key={e.id}
              data-testid="log-entry"
              className="rounded px-1 py-0.5 odd:bg-zinc-50 dark:odd:bg-zinc-800/50"
            >
              <span className="mr-1 font-mono text-zinc-400">R{e.round}</span>
              {e.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
