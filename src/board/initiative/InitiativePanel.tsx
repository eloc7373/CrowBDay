import { ChevronLeft, ChevronRight, Link2, Plus, RotateCcw, Shield, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, inputClass } from '../../app/ui'
import {
  endTurn,
  damageMany,
  healOne,
  setConcentrating,
  toggleConditionLogged,
} from '../../combat/actions'
import { ConcentrationPrompts, Reminders } from '../../combat/ui/CombatPieces'
import { newId } from '../../lib/id'
import {
  addCombatant,
  emptyCombat,
  prevTurn,
  removeCombatant,
  sortedCombatants,
  targetId,
  updateCombatant,
  type Combatant,
  type Side,
} from './model'
import { QUICK_MONSTERS } from './monsters'
import { useCombatStore } from './store'

const SIDE_DOT: Record<Side, string> = {
  pc: 'bg-blue-500',
  ally: 'bg-green-500',
  enemy: 'bg-red-500',
  neutral: 'bg-yellow-500',
}


function AddForm() {
  const update = useCombatStore((s) => s.update)
  const [name, setName] = useState('')
  const [init, setInit] = useState('')
  const [dex, setDex] = useState('0')
  const [hp, setHp] = useState('')
  const [ac, setAc] = useState('')
  const [side, setSide] = useState<Side>('pc')
  const [quick, setQuick] = useState(QUICK_MONSTERS[0].id)
  const [count, setCount] = useState(1)

  const num = (s: string) =>
    s.trim() === '' || !Number.isFinite(Number(s)) ? null : Math.round(Number(s))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const dexMod = num(dex) ?? 0
    const maxHp = num(hp)
    update((s) =>
      addCombatant(s, {
        id: newId('cbt'),
        name: name.trim(),
        initiative: num(init),
        dexMod,
        hp: maxHp !== null ? { current: maxHp, max: maxHp, temp: 0 } : null,
        ac: num(ac),
        conditions: [],
        exhaustion: 0,
        side,
      }),
    )
    setName('')
    setInit('')
    setHp('')
    setAc('')
  }

  const quickAdd = () => {
    const m = QUICK_MONSTERS.find((q) => q.id === quick)!
    update((s) => {
      let next = s
      const existing = s.combatants.filter((c) => c.name.startsWith(m.name)).length
      for (let i = 0; i < count; i++) {
        next = addCombatant(next, {
          id: newId('cbt'),
          name: `${m.name} ${existing + i + 1}`,
          initiative: null,
          dexMod: m.dexMod,
          hp: { current: m.hp, max: m.hp, temp: 0 },
          ac: m.ac,
          conditions: [],
          exhaustion: 0,
          side: 'enemy',
        })
      }
      return next
    })
  }

  return (
    <div className="mb-2 flex flex-col gap-1.5 rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-800/50">
      <form
        onSubmit={submit}
        className="grid grid-cols-6 items-end gap-1"
        aria-label="Add creature"
      >
        <label className="col-span-2 flex flex-col">
          Name
          <input
            aria-label="Creature name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col">
          Init
          <input
            aria-label="Initiative"
            className={inputClass}
            inputMode="numeric"
            value={init}
            onChange={(e) => setInit(e.target.value)}
          />
        </label>
        <label className="flex flex-col">
          Dex mod
          <input
            aria-label="Dex modifier"
            className={inputClass}
            inputMode="numeric"
            value={dex}
            onChange={(e) => setDex(e.target.value)}
          />
        </label>
        <label className="flex flex-col">
          HP
          <input
            aria-label="Max HP"
            className={inputClass}
            inputMode="numeric"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </label>
        <label className="flex flex-col">
          AC
          <input
            aria-label="AC"
            className={inputClass}
            inputMode="numeric"
            value={ac}
            onChange={(e) => setAc(e.target.value)}
          />
        </label>
        <label className="col-span-2 flex flex-col">
          Side
          <select
            aria-label="Side"
            className={inputClass}
            value={side}
            onChange={(e) => setSide(e.target.value as Side)}
          >
            <option value="pc">Player character</option>
            <option value="ally">Ally</option>
            <option value="enemy">Enemy</option>
            <option value="neutral">Neutral</option>
          </select>
        </label>
        <Button type="submit" variant="primary" className="col-span-4 justify-center">
          <Plus size={14} aria-hidden /> Add creature
        </Button>
      </form>
      <div className="flex items-end gap-1">
        <label className="flex flex-1 flex-col">
          Quick add (generic, original stats)
          <select
            aria-label="Quick add monster"
            className={inputClass}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
          >
            {QUICK_MONSTERS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · AC {m.ac} · {m.hp} HP
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-12 flex-col">
          ×
          <input
            aria-label="How many"
            type="number"
            min={1}
            max={10}
            className={inputClass}
            value={count}
            onChange={(e) => setCount(Math.min(10, Math.max(1, e.target.valueAsNumber || 1)))}
          />
        </label>
        <Button onClick={quickAdd}>Add</Button>
      </div>
    </div>
  )
}

function Row({ c, active, selected }: { c: Combatant; active: boolean; selected: boolean }) {
  const update = useCombatStore((s) => s.update)
  const [amount, setAmount] = useState('')
  const hpChange = (sign: 1 | -1) => {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return
    update((s) =>
      sign < 0 ? damageMany(s, [{ id: c.id, amount: n }], 'Damage') : healOne(s, c.id, n),
    )
    setAmount('')
  }
  const down = c.hp && c.hp.current <= 0
  return (
    <li
      data-testid="combatant"
      data-active={active || undefined}
      aria-current={active ? 'step' : undefined}
      className={`rounded-md border p-1.5 text-sm ${
        active
          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
          : 'border-zinc-200 dark:border-zinc-800'
      } ${selected ? 'ring-2 ring-sky-500' : ''} ${down ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <input
          aria-label={`Initiative for ${c.name}`}
          className="w-10 rounded border border-zinc-300 bg-white px-1 text-center font-mono font-bold dark:border-zinc-600 dark:bg-zinc-800"
          inputMode="numeric"
          value={c.initiative ?? ''}
          placeholder="–"
          onChange={(e) => {
            const v = e.target.value.trim()
            const n = Number(v)
            update((s) =>
              updateCombatant(s, c.id, {
                initiative: v === '' || !Number.isFinite(n) ? null : Math.round(n),
              }),
            )
          }}
        />
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${SIDE_DOT[c.side]}`}
          aria-label={c.side}
        />
        <button
          type="button"
          className={`flex-1 truncate text-left font-medium ${down ? 'line-through' : ''}`}
          onClick={() => update((s) => ({ ...s, selectedId: s.selectedId === c.id ? null : c.id }))}
          aria-pressed={selected}
          title="Select (the Conditions panel applies to the selected creature)"
        >
          {c.name}
          <span className="ml-1 text-[10px] font-normal text-zinc-500">
            Dex {c.dexMod >= 0 ? `+${c.dexMod}` : c.dexMod}
          </span>
        </button>
        {c.ac !== null && (
          <span className="flex items-center gap-0.5 text-xs" title="Armor class">
            <Shield size={12} aria-hidden />
            {c.ac}
          </span>
        )}
        {c.hp && (
          <span className="font-mono text-xs" data-testid="hp">
            {c.hp.current}/{c.hp.max}
            {c.hp.temp > 0 && <span className="text-sky-500">+{c.hp.temp}</span>}
          </span>
        )}
        {c.link && <Link2 size={12} className="text-sky-500" aria-label="Linked to a map token" />}
        <button
          type="button"
          aria-label={`Toggle concentration for ${c.name}`}
          aria-pressed={!!c.concentrating}
          title="Concentrating on a spell"
          onClick={() => update((s) => setConcentrating(s, c.id, !c.concentrating))}
          className={`rounded border px-1 text-[10px] font-bold ${
            c.concentrating
              ? 'border-violet-500 bg-violet-500 text-white'
              : 'border-zinc-300 text-zinc-400 dark:border-zinc-600'
          }`}
        >
          C
        </button>
        <button
          type="button"
          aria-label={`Remove ${c.name}`}
          onClick={() => update((s) => removeCombatant(s, c.id))}
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-800"
        >
          <X size={13} aria-hidden />
        </button>
      </div>
      {(active || (c.movedFt ?? 0) > 0) && (c.speed || c.movedFt) ? (
        <p
          className={`mt-0.5 pl-11 text-[11px] ${
            c.speed && (c.movedFt ?? 0) > c.speed ? 'font-semibold text-red-600' : 'text-zinc-500'
          }`}
          data-testid="movement"
        >
          Moved {c.movedFt ?? 0}
          {c.speed ? ` / ${c.speed}` : ''} ft
        </p>
      ) : null}
      {(c.hp || c.conditions.length > 0 || c.exhaustion > 0) && (
        <div className="mt-1 flex flex-wrap items-center gap-1 pl-11">
          {c.hp && (
            <span className="flex items-center gap-0.5">
              <input
                aria-label={`HP change for ${c.name}`}
                className="w-10 rounded border border-zinc-300 bg-white px-1 text-xs dark:border-zinc-600 dark:bg-zinc-800"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && hpChange(-1)}
                placeholder="±"
              />
              <button
                type="button"
                className="rounded bg-red-600 px-1 text-xs text-white"
                onClick={() => hpChange(-1)}
                aria-label={`Damage ${c.name}`}
              >
                −
              </button>
              <button
                type="button"
                className="rounded bg-green-600 px-1 text-xs text-white"
                onClick={() => hpChange(1)}
                aria-label={`Heal ${c.name}`}
              >
                +
              </button>
            </span>
          )}
          {c.exhaustion > 0 && (
            <span className="rounded-full bg-orange-200 px-1.5 text-[11px] text-orange-900 dark:bg-orange-900 dark:text-orange-100">
              Exhaustion {c.exhaustion}
            </span>
          )}
          {c.conditions.map((cond) => (
            <button
              key={cond}
              type="button"
              data-testid="condition-chip"
              onClick={() => update((s) => toggleConditionLogged(s, c.id, cond))}
              className="rounded-full bg-rose-100 px-1.5 text-[11px] text-rose-900 hover:line-through dark:bg-rose-900 dark:text-rose-100"
              aria-label={`Remove ${cond} from ${c.name}`}
            >
              {cond}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

export function InitiativeActions() {
  const state = useCombatStore((s) => s.state)
  const update = useCombatStore((s) => s.update)
  return (
    <>
      <span className="mr-1 text-xs font-semibold" data-testid="round">
        Round {state.round}
      </span>
      <Button
        variant="ghost"
        className="!px-1"
        aria-label="Previous turn"
        onClick={() => update(prevTurn)}
      >
        <ChevronLeft size={15} aria-hidden />
      </Button>
      <Button
        variant="primary"
        className="!px-2 !py-0.5 text-xs"
        aria-label="Next turn"
        onClick={() => update(endTurn)}
      >
        Next <ChevronRight size={14} aria-hidden />
      </Button>
      <Button
        variant="ghost"
        className="!px-1"
        aria-label="Clear combat"
        title="Clear combat"
        onClick={() => {
          if (
            state.combatants.length === 0 ||
            window.confirm('Clear all creatures and reset to round 1?')
          )
            update(() => emptyCombat())
        }}
      >
        <RotateCcw size={14} aria-hidden />
      </Button>
    </>
  )
}

export function InitiativePanel() {
  const state = useCombatStore((s) => s.state)
  const order = sortedCombatants(state.combatants)
  const target = targetId(state)
  const activeIndex = order.findIndex((c) => c.id === state.activeId)
  const nextUp = order.length ? order[activeIndex < 0 ? 0 : (activeIndex + 1) % order.length] : null
  return (
    <div>
      <Reminders />
      <ConcentrationPrompts />
      <AddForm />
      {nextUp && (
        <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm dark:border-amber-700 dark:bg-amber-950" aria-live="polite">
          <strong>{state.activeId ? 'Next up:' : 'First up:'}</strong> {nextUp.name}
          {state.activeId && order.length > 1 && (
            <span className="text-zinc-500"> · after {order.find((c) => c.id === state.activeId)?.name}</span>
          )}
        </p>
      )}
      {order.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">
          No creatures yet. Add the party and the monsters, then press Next.
        </p>
      ) : (
        <ol aria-label="Turn order" className="flex flex-col gap-1">
          {order.map((c) => (
            <Row
              key={c.id}
              c={c}
              active={c.id === state.activeId}
              selected={c.id === target && c.id !== state.activeId}
            />
          ))}
        </ol>
      )}
    </div>
  )
}
