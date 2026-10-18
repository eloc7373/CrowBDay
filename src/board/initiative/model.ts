// Initiative tracker model. Pure functions; the store persists the state.
//
// Turn order: initiative high → low. Ties are broken by Dexterity modifier
// (high → low), then by the order creatures were added. The active creature is
// tracked by id, so adding/removing/re-ordering mid-combat keeps the right turn.

export type Side = 'pc' | 'ally' | 'enemy' | 'neutral'

/** A timed effect on a creature (a spell, a poison, "until the end of its next turn"). */
export interface Effect {
  id: string
  name: string
  /** Rounds left; null = no countdown. Counts down at the end of the creature's turn. */
  rounds: number | null
  /** When to remind the DM on the creature's turn. */
  remind: 'start' | 'end' | null
}

export interface Combatant {
  id: string
  name: string
  /** null = not rolled yet (sorted last). */
  initiative: number | null
  dexMod: number
  /** Optional printed initiative modifier, which may differ from Dexterity. */
  initiativeBonus?: number
  hp: { current: number; max: number; temp: number } | null
  ac: number | null
  conditions: string[]
  /** Exhaustion level 0–6. */
  exhaustion: number
  side: Side
  /**
   * Optional link to a map token (Combat Mode). While linked, this combatant is the
   * source of truth for HP, conditions and AC; the map draws them from here.
   */
  link?: { mapId: string; tokenId: string } | null
  /** Walking speed in feet (for movement tracking). */
  speed?: number | null
  /** Feet moved this turn (reset when the turn starts). */
  movedFt?: number
  /** Constitution save modifier, shown on concentration prompts. */
  conMod?: number
  concentrating?: boolean
  effects?: Effect[]
  /** Insertion counter, for stable tie-breaking. */
  order: number
}

export type CombatState = CombatBase & CombatExtras

export interface LogEntry {
  id: string
  kind: 'damage' | 'heal' | 'condition' | 'roll' | 'turn' | 'move' | 'note'
  text: string
  round: number
  /** State before the action, so it can be undone. */
  before?: CombatBase & Partial<CombatExtras>
}

export interface ConcentrationPrompt {
  id: string
  combatantId: string
  dc: number
}

/** Fields added by Combat Mode; optional so combat saved by older builds still loads. */
export interface CombatExtras {
  log: LogEntry[]
  /** Start/end-of-turn prompts waiting to be dismissed. */
  reminders: { id: string; text: string }[]
  concentrationPrompts: ConcentrationPrompt[]
}

export interface CombatBase {
  combatants: Combatant[]
  round: number
  activeId: string | null
  /** Creature the Conditions panel edits (defaults to the active one). */
  selectedId: string | null
  nextOrder: number
}

export const emptyCombat = (): CombatState => ({
  combatants: [],
  round: 1,
  activeId: null,
  selectedId: null,
  nextOrder: 0,
  log: [],
  reminders: [],
  concentrationPrompts: [],
})

export function sortedCombatants(list: readonly Combatant[]): Combatant[] {
  return [...list].sort((a, b) => {
    const ai = a.initiative ?? -Infinity
    const bi = b.initiative ?? -Infinity
    if (ai !== bi) return bi - ai
    if (a.dexMod !== b.dexMod) return b.dexMod - a.dexMod
    return a.order - b.order
  })
}

export function addCombatant(s: CombatState, c: Omit<Combatant, 'order'>): CombatState {
  return {
    ...s,
    combatants: [...s.combatants, { ...c, order: s.nextOrder }],
    nextOrder: s.nextOrder + 1,
  }
}

export function updateCombatant(
  s: CombatState,
  id: string,
  patch: Partial<Combatant>,
): CombatState {
  return { ...s, combatants: s.combatants.map((c) => (c.id === id ? { ...c, ...patch, id } : c)) }
}

export function removeCombatant(s: CombatState, id: string): CombatState {
  let activeId = s.activeId
  if (activeId === id) {
    // Hand the turn to whoever is next in order.
    const order = sortedCombatants(s.combatants)
    const i = order.findIndex((c) => c.id === id)
    const rest = order.filter((c) => c.id !== id)
    activeId = rest.length ? (order[i + 1] ?? rest[0]).id : null
  }
  return {
    ...s,
    combatants: s.combatants.filter((c) => c.id !== id),
    activeId,
    selectedId: s.selectedId === id ? null : s.selectedId,
  }
}

/** Advances to the next creature; wrapping past the last one starts a new round. */
export function nextTurn(s: CombatState): CombatState {
  const order = sortedCombatants(s.combatants)
  if (!order.length) return s
  const i = order.findIndex((c) => c.id === s.activeId)
  if (i === -1) return { ...s, activeId: order[0].id }
  if (i === order.length - 1) return { ...s, activeId: order[0].id, round: s.round + 1 }
  return { ...s, activeId: order[i + 1].id }
}

/** Steps back one turn; stepping back from the first creature returns to the previous round. */
export function prevTurn(s: CombatState): CombatState {
  const order = sortedCombatants(s.combatants)
  if (!order.length) return s
  const i = order.findIndex((c) => c.id === s.activeId)
  if (i === -1) return { ...s, activeId: order[0].id }
  if (i === 0) {
    if (s.round <= 1) return s
    return { ...s, activeId: order[order.length - 1].id, round: s.round - 1 }
  }
  return { ...s, activeId: order[i - 1].id }
}

/** Damage uses temporary HP first; healing is capped at max and starts from 0. */
export function applyHp(c: Combatant, amount: number): Combatant {
  if (!c.hp || !Number.isFinite(amount) || amount === 0) return c
  if (amount < 0) {
    const dmg = -amount
    const fromTemp = Math.min(c.hp.temp, dmg)
    return {
      ...c,
      hp: {
        ...c.hp,
        temp: c.hp.temp - fromTemp,
        current: Math.max(0, c.hp.current - (dmg - fromTemp)),
      },
    }
  }
  return { ...c, hp: { ...c.hp, current: Math.min(c.hp.max, Math.max(0, c.hp.current) + amount) } }
}

export function toggleCondition(c: Combatant, name: string): Combatant {
  const has = c.conditions.some((x) => x.toLowerCase() === name.toLowerCase())
  return {
    ...c,
    conditions: has
      ? c.conditions.filter((x) => x.toLowerCase() !== name.toLowerCase())
      : [...c.conditions, name],
  }
}

/** The creature the Conditions panel acts on. */
export const targetId = (s: CombatState) => s.selectedId ?? s.activeId
