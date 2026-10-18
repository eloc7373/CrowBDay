// Combat Mode rules helpers. Pure functions over CombatState: each returns a new
// state, and the ones that change the game record a log entry that can be undone.
//
// These are DM aids that follow the SRD 5.1 wording; the DM has the final say.

import {
  applyHp,
  nextTurn,
  updateCombatant,
  type Combatant,
  type CombatState,
  type Effect,
  type LogEntry,
} from '../board/initiative/model'
import { newId } from '../lib/id'

const LOG_MAX = 80

/** Concentration save DC: 10, or half the damage taken if that is higher (SRD 5.1). */
export const concentrationDc = (damage: number) => Math.max(10, Math.floor(damage / 2))

const find = (s: CombatState, id: string) => s.combatants.find((c) => c.id === id)

/** State without the log, for storing as an undo snapshot. */
function snapshot(s: CombatState): LogEntry['before'] {
  const rest: Partial<CombatState> = { ...s }
  delete rest.log
  return rest as LogEntry['before']
}

/** Applies `change` and records a log entry holding the previous state. */
export function logged(
  s: CombatState,
  kind: LogEntry['kind'],
  text: string,
  change: (s: CombatState) => CombatState,
): CombatState {
  const next = change(s)
  const entry: LogEntry = { id: newId('log'), kind, text, round: s.round, before: snapshot(s) }
  return { ...next, log: [entry, ...s.log].slice(0, LOG_MAX) }
}

/** Replaces the text of the newest log entry (used when the text depends on the change). */
function retitle(s: CombatState, text: string): CombatState {
  const [first, ...rest] = s.log
  return first ? { ...s, log: [{ ...first, text }, ...rest] } : s
}

/** Records a log line that has nothing to undo (e.g. a roll that changed nothing). */
export function note(s: CombatState, kind: LogEntry['kind'], text: string): CombatState {
  const entry: LogEntry = { id: newId('log'), kind, text, round: s.round }
  return { ...s, log: [entry, ...s.log].slice(0, LOG_MAX) }
}

export function recordCombatNote(s: CombatState, text: string): CombatState {
  const active = s.combatants.find((c) => c.id === s.activeId)
  const prefix = `Round ${s.round}${active ? ` · ${active.name}` : ''}`
  return note(s, 'note', `${prefix}: ${text.trim()}`)
}

/** Reverts the most recent undoable log entry (and drops it and anything newer). */
export function undoLast(s: CombatState): CombatState {
  const i = s.log.findIndex((e) => e.before)
  if (i === -1) return s
  const before = s.log[i].before!
  return {
    ...s,
    ...before,
    reminders: before.reminders ?? [],
    concentrationPrompts: before.concentrationPrompts ?? [],
    log: s.log.slice(i + 1),
  }
}

export interface DamageTarget {
  id: string
  amount: number
  /** Halve the damage (rounded down), e.g. after a successful save. */
  half?: boolean
}

/** Damage to one creature, with the concentration and zero-HP consequences. */
function hit(
  s: CombatState,
  id: string,
  amount: number,
): { state: CombatState; text: string } | null {
  const c = find(s, id)
  if (!c || !c.hp || amount <= 0) return null
  const after = applyHp(c, -amount)
  const hp = after.hp!
  let state = updateCombatant(s, id, after)
  let text = `${c.name} takes ${amount} (${hp.current}/${hp.max})`
  if (hp.current <= 0 && c.hp.current > 0) {
    text += ', drops to 0'
    if (c.concentrating) {
      state = updateCombatant(state, id, { concentrating: false })
      text += ', concentration ends'
    }
  } else if (c.concentrating && hp.current > 0) {
    state = {
      ...state,
      concentrationPrompts: [
        ...state.concentrationPrompts.filter((p) => p.combatantId !== id),
        { id: newId('conc'), combatantId: id, dc: concentrationDc(amount) },
      ],
    }
  }
  return { state, text }
}

/** Damage to several creatures at once; `half` applies to those who saved. One undo step. */
export function damageMany(
  s: CombatState,
  targets: DamageTarget[],
  source = 'Damage',
): CombatState {
  const lines: string[] = []
  const next = logged(s, 'damage', source, (st) => {
    let cur = st
    for (const t of targets) {
      const amount = t.half ? Math.floor(t.amount / 2) : t.amount
      const r = hit(cur, t.id, amount)
      if (r) {
        cur = r.state
        lines.push(r.text)
      }
    }
    return cur
  })
  return lines.length ? retitle(next, `${source}: ${lines.join('; ')}`) : s
}

export function healOne(s: CombatState, id: string, amount: number): CombatState {
  const c = find(s, id)
  if (!c?.hp || amount <= 0) return s
  const healed = applyHp(c, amount)
  return logged(
    s,
    'heal',
    `${c.name} heals ${amount} (${healed.hp!.current}/${healed.hp!.max})`,
    (st) => updateCombatant(st, id, healed),
  )
}

export function setConcentrating(s: CombatState, id: string, on: boolean): CombatState {
  const c = find(s, id)
  if (!c) return s
  return logged(s, 'note', `${c.name} ${on ? 'starts' : 'stops'} concentrating`, (st) => ({
    ...updateCombatant(st, id, { concentrating: on }),
    concentrationPrompts: on
      ? st.concentrationPrompts
      : st.concentrationPrompts.filter((p) => p.combatantId !== id),
  }))
}

/** Resolves a concentration prompt: a failed save ends concentration. */
export function resolveConcentration(
  s: CombatState,
  promptId: string,
  passed: boolean,
): CombatState {
  const p = s.concentrationPrompts.find((x) => x.id === promptId)
  if (!p) return s
  const c = find(s, p.combatantId)
  const rest = s.concentrationPrompts.filter((x) => x.id !== promptId)
  if (!c) return { ...s, concentrationPrompts: rest }
  return logged(
    s,
    'roll',
    `${c.name} ${passed ? 'keeps' : 'loses'} concentration (DC ${p.dc})`,
    (st) => ({
      ...(passed ? st : updateCombatant(st, c.id, { concentrating: false })),
      concentrationPrompts: rest,
    }),
  )
}

export function toggleConditionLogged(s: CombatState, id: string, name: string): CombatState {
  const c = find(s, id)
  if (!c) return s
  const has = c.conditions.some((x) => x.toLowerCase() === name.toLowerCase())
  return logged(s, 'condition', `${c.name} ${has ? 'loses' : 'gains'} ${name}`, (st) =>
    updateCombatant(st, id, {
      conditions: has
        ? c.conditions.filter((x) => x.toLowerCase() !== name.toLowerCase())
        : [...c.conditions, name],
    }),
  )
}

export function addEffect(s: CombatState, id: string, e: Omit<Effect, 'id'>): CombatState {
  const c = find(s, id)
  if (!c) return s
  const effect: Effect = { ...e, id: newId('fx') }
  return logged(s, 'note', `${c.name}: ${e.name}${e.rounds ? ` (${e.rounds} rounds)` : ''}`, (st) =>
    updateCombatant(st, id, { effects: [...(c.effects ?? []), effect] }),
  )
}

export function removeEffect(s: CombatState, id: string, effectId: string): CombatState {
  const c = find(s, id)
  if (!c) return s
  return updateCombatant(s, id, { effects: (c.effects ?? []).filter((e) => e.id !== effectId) })
}

/**
 * Ends the active creature's turn and starts the next one:
 * - effects on the creature whose turn ends count down, and expire at 0 rounds
 * - the new active creature's movement resets
 * - reminders are queued for effects (and conditions) on the creature starting or ending its turn
 */
export function endTurn(s: CombatState): CombatState {
  if (!s.combatants.length) return s
  const reminders: { id: string; text: string }[] = []
  const remind = (text: string) => reminders.push({ id: newId('rem'), text })
  let cur = s
  const ending = s.activeId ? find(s, s.activeId) : undefined

  if (ending) {
    const kept: Effect[] = []
    for (const e of ending.effects ?? []) {
      if (e.remind === 'end') remind(`${ending.name}, end of turn: ${e.name}`)
      if (e.rounds === null) {
        kept.push(e)
      } else if (e.rounds - 1 <= 0) {
        remind(`${e.name} on ${ending.name} has ended`)
      } else {
        kept.push({ ...e, rounds: e.rounds - 1 })
      }
    }
    cur = updateCombatant(cur, ending.id, { effects: kept })
  }

  cur = nextTurn(cur)
  const starting = cur.activeId ? find(cur, cur.activeId) : undefined
  if (starting) {
    cur = updateCombatant(cur, starting.id, { movedFt: 0 })
    for (const e of starting.effects ?? []) {
      if (e.remind === 'start') remind(`${starting.name}, start of turn: ${e.name}`)
    }
    if (starting.conditions.length) remind(`${starting.name} is ${starting.conditions.join(', ')}`)
  }
  const text = starting ? `Round ${cur.round}: ${starting.name}'s turn` : 'Turn ended'
  const result = cur
  return logged(s, 'turn', text, () => ({ ...result, reminders }))
}

export const dismissReminder = (s: CombatState, id: string): CombatState => ({
  ...s,
  reminders: s.reminders.filter((r) => r.id !== id),
})

export interface RestResetOptions {
  restoreHp: boolean
  clearTempHp: boolean
  clearConditions: boolean
  clearExhaustion: boolean
  clearTimedEffects: boolean
  endConcentration: boolean
  resetMovement: boolean
}

/** Applies the DM-selected rest checklist as one undoable combat action. */
export function restRecovery(
  s: CombatState,
  ids: string[],
  rest: 'short' | 'long',
  options: RestResetOptions,
): CombatState {
  const targets = new Set(ids)
  const changed = s.combatants.filter((c) => targets.has(c.id))
  if (!changed.length) return s
  const next = logged(s, 'note', `${rest === 'short' ? 'Short' : 'Long'} rest`, (state) => ({
    ...state,
    combatants: state.combatants.map((c) => {
      if (!targets.has(c.id)) return c
      const hp = c.hp
        ? {
            ...c.hp,
            ...(options.restoreHp ? { current: c.hp.max } : {}),
            ...(options.clearTempHp ? { temp: 0 } : {}),
          }
        : null
      return {
        ...c,
        ...(hp ? { hp } : {}),
        ...(options.clearConditions ? { conditions: [] } : {}),
        ...(options.clearExhaustion ? { exhaustion: 0 } : {}),
        ...(options.clearTimedEffects
          ? { effects: (c.effects ?? []).filter((effect) => effect.rounds === null) }
          : {}),
        ...(options.endConcentration ? { concentrating: false } : {}),
        ...(options.resetMovement ? { movedFt: 0 } : {}),
      }
    }),
    ...(options.endConcentration
      ? {
          concentrationPrompts: state.concentrationPrompts.filter((p) => !targets.has(p.combatantId)),
        }
      : {}),
  }))
  const names = changed.map((c) => c.name).join(', ')
  return retitle(next, `${rest === 'short' ? 'Short' : 'Long'} rest: ${names}`)
}

/** Adds feet moved by a creature this turn, logging it. */
export function addMovement(s: CombatState, id: string, feet: number): CombatState {
  const c = find(s, id)
  if (!c || feet <= 0) return s
  const total = (c.movedFt ?? 0) + feet
  return logged(
    s,
    'move',
    `${c.name} moves ${feet} ft (${total}${c.speed ? `/${c.speed}` : ''} ft this turn)`,
    (st) => updateCombatant(st, id, { movedFt: total }),
  )
}

// ---- Group rolls ----------------------------------------------------------

export type Roller = () => number

export const d20: Roller = () => Math.floor(Math.random() * 20) + 1

/**
 * Rolls initiative (d20 + Dex) for the given creatures. With `shareByName`,
 * creatures with the same base name ("Goblin 1", "Goblin 2") share one d20.
 */
export function rollInitiativeGroup(
  s: CombatState,
  ids: string[],
  opts: { shareByName?: boolean; roller?: Roller } = {},
): CombatState {
  const roller = opts.roller ?? d20
  const targets = s.combatants.filter((c) => ids.includes(c.id))
  if (!targets.length) return s
  const shared = new Map<string, number>()
  const parts: string[] = []
  const next = logged(s, 'roll', 'Initiative', (st) => {
    let cur = st
    for (const c of targets) {
      const key = c.name.replace(/\s+\d+$/, '')
      let die = opts.shareByName ? shared.get(key) : undefined
      if (die === undefined) {
        die = roller()
        if (opts.shareByName) shared.set(key, die)
      }
      const total = die + (c.initiativeBonus ?? c.dexMod)
      parts.push(`${c.name} ${total}`)
      cur = updateCombatant(cur, c.id, { initiative: total })
    }
    return cur
  })
  return retitle(next, `Initiative: ${parts.join(', ')}`)
}

export interface SaveResult {
  id: string
  name: string
  die: number
  total: number
  passed: boolean
}

export type Advantage = 'normal' | 'advantage' | 'disadvantage'

type Named = Pick<Combatant, 'id' | 'name'>

/** Rolls a saving throw for each creature. Nothing is applied; the caller decides what to do. */
export function rollSaves(
  creatures: Named[],
  bonus: (c: Named) => number,
  dc: number,
  mode: Advantage = 'normal',
  roller: Roller = d20,
): SaveResult[] {
  return creatures.map((c) => {
    const a = roller()
    const die =
      mode === 'normal' ? a : mode === 'advantage' ? Math.max(a, roller()) : Math.min(a, roller())
    const total = die + bonus(c)
    return { id: c.id, name: c.name, die, total, passed: total >= dc }
  })
}
