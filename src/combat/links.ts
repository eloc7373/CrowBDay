// Links between map tokens and initiative combatants.
//
// Source of truth: once a token is linked, the combatant owns HP, AC and
// conditions. The map draws those values from the combatant (see linkedProps),
// and the token's own copies are only the starting values.

import { addCombatant, type Combatant, type CombatState } from '../board/initiative/model'
import { useCombatStore } from '../board/initiative/store'
import { newId } from '../lib/id'
import type { PlacedProp, TokenInfo } from '../mapcreator/layers/model'

export function combatantForToken(
  s: Pick<CombatState, 'combatants'>,
  mapId: string,
  tokenId: string,
): Combatant | undefined {
  return s.combatants.find((c) => c.link?.mapId === mapId && c.link.tokenId === tokenId)
}

export function tokenForCombatant(c: Combatant | undefined, mapId: string): string | null {
  return c?.link && c.link.mapId === mapId ? c.link.tokenId : null
}

/** Props with each linked token's HP, AC and conditions replaced by its combatant's. */
export function linkedProps(
  props: PlacedProp[],
  combatants: Combatant[],
  mapId: string,
): PlacedProp[] {
  if (!combatants.some((c) => c.link?.mapId === mapId)) return props
  const byToken = new Map<string, Combatant>()
  for (const c of combatants) if (c.link?.mapId === mapId) byToken.set(c.link.tokenId, c)
  return props.map((p) => {
    const c = p.token && byToken.get(p.id)
    if (!c || !p.token) return p
    return { ...p, token: { ...p.token, hp: c.hp, ac: c.ac, conditions: c.conditions } }
  })
}

/** The combatant a freshly linked token starts as. */
export function combatantFromToken(mapId: string, p: PlacedProp, t: TokenInfo): Combatant {
  return {
    id: newId('cbt'),
    name: t.name,
    initiative: null,
    dexMod: t.initiativeBonus ?? 0,
    hp: t.hp ? { ...t.hp } : null,
    ac: t.ac,
    conditions: [...t.conditions],
    exhaustion: 0,
    side: t.side,
    link: { mapId, tokenId: p.id },
    speed: t.speed,
    order: 0,
  }
}

/** Adds a token to initiative (no-op if it is already there). Returns the combatant id. */
export function addTokenToInitiative(mapId: string, p: PlacedProp): string | null {
  if (!p.token) return null
  const store = useCombatStore.getState()
  const existing = combatantForToken(store.state, mapId, p.id)
  if (existing) return existing.id
  const c = combatantFromToken(mapId, p, p.token)
  const { order: _order, ...rest } = c
  void _order
  store.update((s) => addCombatant(s, rest))
  return c.id
}

export function unlinkToken(mapId: string, tokenId: string) {
  useCombatStore.getState().update((s) => {
    const c = combatantForToken(s, mapId, tokenId)
    if (!c) return s
    return {
      ...s,
      combatants: s.combatants.map((x) => (x.id === c.id ? { ...x, link: null } : x)),
    }
  })
}
