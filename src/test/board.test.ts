import { describe, expect, it } from 'vitest'
import { DiceError, parseDice, roll } from '../board/dice/dice'
import {
  addCombatant,
  applyHp,
  emptyCombat,
  nextTurn,
  prevTurn,
  removeCombatant,
  sortedCombatants,
  toggleCondition,
  type Combatant,
  type CombatState,
} from '../board/initiative/model'
import sample from '../data/rules-sample.json'
import { conditionDocs, createSearch, ruleDocs } from '../board/rules/search'
import { validateRules } from '../board/rules/validate'
import { travel } from '../board/tools/travel'

/** Deterministic die: cycles through the given values. */
const fixed = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('dice parser', () => {
  it('parses 1d20+5, 2d6-1 and 4d6kh3', () => {
    expect(parseDice('1d20+5')).toEqual([
      { kind: 'dice', sign: 1, count: 1, sides: 20, keep: null },
      { kind: 'const', sign: 1, value: 5 },
    ])
    expect(parseDice('2d6-1')).toEqual([
      { kind: 'dice', sign: 1, count: 2, sides: 6, keep: null },
      { kind: 'const', sign: -1, value: 1 },
    ])
    expect(parseDice('4d6kh3')).toEqual([
      { kind: 'dice', sign: 1, count: 4, sides: 6, keep: { mode: 'kh', n: 3 } },
    ])
  })

  it('accepts shorthand, whitespace, case and multiple terms', () => {
    expect(parseDice('d20')[0]).toMatchObject({ count: 1, sides: 20 })
    expect(parseDice('d%')[0]).toMatchObject({ sides: 100 })
    expect(parseDice(' 2D8 + 1d6 + 3 ')).toHaveLength(3)
    expect(parseDice('-1+1d4')[0]).toEqual({ kind: 'const', sign: -1, value: 1 })
    expect(parseDice('2d20kl1')[0]).toMatchObject({ keep: { mode: 'kl', n: 1 } })
  })

  it('rejects malformed input with readable errors', () => {
    const msg = (s: string) => {
      try {
        parseDice(s)
        return ''
      } catch (e) {
        expect(e).toBeInstanceOf(DiceError)
        return (e as Error).message
      }
    }
    expect(msg('')).toBe('Enter a roll, for example 1d20+5 or 4d6kh3.')
    expect(msg('2d')).toBe('Expected the number of sides after "d" but found the end.')
    expect(msg('1d20+')).toBe('The roll ends with "+"; add a number or dice after it.')
    expect(msg('1d20++5')).toBe('Expected a number or dice (like 2d6) but found "+" at position 6.')
    expect(msg('abc')).toBe('Expected a number or dice (like 2d6) but found "a" at position 1.')
    expect(msg('2x6')).toBe('Unexpected "x" at position 2. Use + or - between parts, e.g. 2d6+3.')
    expect(msg('d0')).toBe('Dice need 2 to 1000 sides (got d0).')
    expect(msg('101d6')).toBe('Roll between 1 and 100 dice at a time (got 101).')
    expect(msg('4d6kh5')).toBe("Can't keep 5 of 4 dice in 4d6kh5.")
    expect(msg('4d6k3')).toBe('Use "kh" (keep highest) or "kl" (keep lowest) at position 4.')
    expect(msg('4d6kh')).toBe('Expected how many dice to keep after "kh" (e.g. kh1).')
  })
})

describe('dice roller', () => {
  it('totals with modifiers and shows the working', () => {
    const r = roll('1d20+5', 'normal', fixed(14))
    expect(r.total).toBe(19)
    expect(r.natural).toBe(14)
    expect(r.text).toBe('1d20+5: [14] + 5 = 19')
    expect(roll('2d6-1', 'normal', fixed(3, 4)).total).toBe(6)
  })

  it('keeps the highest 3 of 4d6', () => {
    const r = roll('4d6kh3', 'normal', fixed(2, 6, 1, 5))
    expect(r.total).toBe(13)
    expect(r.text).toBe('4d6kh3: [2, 6, ~~1~~, 5] = 13')
  })

  it('applies advantage/disadvantage to a single d20 only', () => {
    const adv = roll('1d20+3', 'advantage', fixed(7, 16))
    expect(adv).toMatchObject({
      modeApplied: true,
      total: 19,
      natural: 16,
      expression: '2d20kh1+3',
    })
    const dis = roll('d20', 'disadvantage', fixed(7, 16))
    expect(dis).toMatchObject({ total: 7, natural: 7 })
    const dmg = roll('2d6+2', 'advantage', fixed(1, 1))
    expect(dmg.modeApplied).toBe(false)
    expect(dmg.natural).toBeNull()
  })

  it('real dice stay in range', () => {
    for (let i = 0; i < 200; i++) {
      const r = roll('3d6')
      expect(r.total).toBeGreaterThanOrEqual(3)
      expect(r.total).toBeLessThanOrEqual(18)
    }
  })
})

describe('initiative', () => {
  const c = (id: string, initiative: number | null, dexMod = 0): Omit<Combatant, 'order'> => ({
    id,
    name: id,
    initiative,
    dexMod,
    hp: { current: 10, max: 10, temp: 0 },
    ac: 12,
    conditions: [],
    exhaustion: 0,
    side: 'enemy',
  })
  const build = (...list: Omit<Combatant, 'order'>[]) =>
    list.reduce<CombatState>((s, x) => addCombatant(s, x), emptyCombat())
  const names = (s: CombatState) => sortedCombatants(s.combatants).map((x) => x.id)

  it('sorts by initiative, then Dex modifier, then the order added', () => {
    const s = build(
      c('goblin', 12, 2),
      c('fighter', 15, 1),
      c('rogue', 12, 4),
      c('wizard', 12, 2),
      c('late', null, 5),
      c('cleric', 3, 0),
    )
    expect(names(s)).toEqual(['fighter', 'rogue', 'goblin', 'wizard', 'cleric', 'late'])
  })

  it('advances turns, wraps rounds and steps back', () => {
    let s = build(c('a', 20), c('b', 10), c('c', 5))
    s = nextTurn(s)
    expect([s.activeId, s.round]).toEqual(['a', 1])
    s = nextTurn(nextTurn(s))
    expect([s.activeId, s.round]).toEqual(['c', 1])
    s = nextTurn(s)
    expect([s.activeId, s.round]).toEqual(['a', 2])
    s = prevTurn(s)
    expect([s.activeId, s.round]).toEqual(['c', 1])
    s = prevTurn(prevTurn(prevTurn(s)))
    expect([s.activeId, s.round]).toEqual(['a', 1]) // can't go before round 1
  })

  it('keeps the right turn when creatures are added or removed', () => {
    let s = nextTurn(nextTurn(build(c('a', 20), c('b', 10), c('c', 5))))
    expect(s.activeId).toBe('b')
    s = addCombatant(s, c('fast', 25))
    expect(s.activeId).toBe('b')
    s = removeCombatant(s, 'b')
    expect(s.activeId).toBe('c')
    s = removeCombatant(removeCombatant(removeCombatant(s, 'c'), 'a'), 'fast')
    expect(s.activeId).toBeNull()
  })

  it('applies damage to temporary HP first and caps healing', () => {
    const x = { ...c('x', 1), order: 0, hp: { current: 10, max: 12, temp: 3 } }
    expect(applyHp(x, -5).hp).toEqual({ current: 8, max: 12, temp: 0 })
    expect(applyHp(x, -50).hp!.current).toBe(0)
    expect(applyHp({ ...x, hp: { current: 0, max: 12, temp: 0 } }, 20).hp!.current).toBe(12)
    expect(toggleCondition(toggleCondition(x, 'Prone'), 'prone').conditions).toEqual([])
  })
})

describe('rules search', () => {
  const v = validateRules(sample)
  const search = createSearch([...ruleDocs(v.entries), ...conditionDocs()])
  const ids = (q: string) => search(q).map((d) => d.id)

  it("sample rules are valid and sourced to the 2014 Player's Handbook", () => {
    expect(v.errors).toEqual([])
    expect(v.entries.length).toBeGreaterThanOrEqual(30)
    for (const e of v.entries) {
      expect(e.source.book).toMatch(/Player's Handbook \(2014\)/)
      for (const r of e.related)
        expect(
          v.entries.some((x) => x.id === r),
          `${e.id} → ${r}`,
        ).toBe(true)
    }
  })

  it('finds rules by title', () => {
    expect(ids('opportunity attack')[0]).toBe('rules/combat/opportunity-attack')
    expect(ids('fireball')[0]).toBe('spells/fireball')
    expect(ids('grapled')[0]).toBe('conditions/grappled') // typo-tolerant
  })

  it('finds rules by tag', () => {
    expect(ids('darkvision')).toContain('rules/exploration/vision-and-light')
    expect(ids('forced march')).toContain('rules/exploration/travel-pace')
  })

  it('finds rules by body text', () => {
    // "Massive damage" only appears in the body of death saving throws.
    expect(ids('massive damage')).toContain('rules/combat/death-saving-throws')
    expect(ids('component pouch')).toContain('rules/spellcasting/components')
  })

  it('labels spells and conditions', () => {
    expect(search('fireball')[0].kind).toBe('spell')
    expect(search('prone')[0]).toMatchObject({ kind: 'condition', category: 'conditions' })
  })
})

describe('rules import validation', () => {
  it('keeps valid entries and reports bad ones', () => {
    const v = validateRules({
      name: 'My notes',
      entries: [
        {
          id: 'a',
          title: 'A',
          category: 'combat',
          summary: 's',
          body: 'b',
          source: { book: 'Me', license: 'personal' },
          tags: ['X'],
          related: [],
        },
        {
          id: 'a',
          title: 'Dup',
          category: 'combat',
          summary: 's',
          body: 'b',
          source: { book: 'Me', license: 'p' },
        },
        {
          id: 'c',
          title: 'C',
          category: 'magic',
          summary: 's',
          body: 'b',
          source: { book: 'Me', license: 'p' },
        },
        'nope',
      ],
    })
    expect(v.name).toBe('My notes')
    expect(v.entries.map((e) => e.id)).toEqual(['a'])
    expect(v.entries[0].tags).toEqual(['x'])
    expect(v.errors).toEqual([
      'entries[1] ("a"): id: "a" is used more than once.',
      'entries[2] ("c"): category: must be one of combat, spellcasting, conditions, exploration, social, rest, equipment, other.',
      'entries[3]: must be an object.',
    ])
    expect(validateRules('x').errors[0]).toMatch(/Expected an array/)
  })
})

describe('travel pace', () => {
  it('matches the per-day table for an 8-hour day', () => {
    expect(travel('normal', 8, false).milesPerDay).toBe(24)
    expect(travel('fast', 8, false).milesPerDay).toBe(30)
    expect(travel('slow', 8, false).milesPerDay).toBe(18)
  })
  it('halves in difficult terrain, computes days and forced march DCs', () => {
    expect(travel('normal', 8, true).milesPerDay).toBe(12)
    expect(travel('normal', 8, false, 60).days).toBe(2.5)
    expect(travel('normal', 10, false)).toMatchObject({
      forcedMarchHours: 2,
      forcedMarchDc: 12,
      milesPerDay: 30,
    })
  })
})
