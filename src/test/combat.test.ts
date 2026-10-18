import { describe, expect, it } from 'vitest'
import {
  addEffect,
  concentrationDc,
  damageMany,
  endTurn,
  healOne,
  logged,
  resolveConcentration,
  rollInitiativeGroup,
  rollSaves,
  setConcentrating,
  undoLast,
  addMovement,
} from '../combat/actions'
import { movePath } from '../combat/movement'
import { templateCells, tokensInCells } from '../combat/templates'
import {
  addCombatant,
  emptyCombat,
  type Combatant,
  type CombatState,
} from '../board/initiative/model'
import {
  createEmptyMap,
  defaultTokenInfo,
  edgeKey,
  type AssetMeta,
  type MapDoc,
} from '../mapcreator/layers/model'

const fixed = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

const creature = (id: string, over: Partial<Combatant> = {}): Omit<Combatant, 'order'> => ({
  id,
  name: id,
  initiative: 10,
  dexMod: 0,
  hp: { current: 20, max: 20, temp: 0 },
  ac: 12,
  conditions: [],
  exhaustion: 0,
  side: 'enemy',
  ...over,
})

const combat = (...cs: Omit<Combatant, 'order'>[]): CombatState =>
  cs.reduce((s, c) => addCombatant(s, c), emptyCombat())

const hp = (s: CombatState, id: string) => s.combatants.find((c) => c.id === id)!.hp!.current

describe('batch damage', () => {
  it('halves for those who saved and rounds down', () => {
    const s = damageMany(
      combat(creature('a'), creature('b')),
      [
        { id: 'a', amount: 15 },
        { id: 'b', amount: 15, half: true },
      ],
      'Fireball',
    )
    expect(hp(s, 'a')).toBe(5)
    expect(hp(s, 'b')).toBe(13)
    expect(s.log[0].text).toContain('Fireball')
  })

  it('uses temporary HP first and never goes below 0', () => {
    let s = combat(creature('a', { hp: { current: 5, max: 20, temp: 3 } }))
    s = damageMany(s, [{ id: 'a', amount: 4 }])
    expect(s.combatants[0].hp).toEqual({ current: 4, max: 20, temp: 0 })
    s = damageMany(s, [{ id: 'a', amount: 99 }])
    expect(hp(s, 'a')).toBe(0)
  })

  it('is one undo step covering every target', () => {
    const start = combat(creature('a'), creature('b'))
    const s = damageMany(start, [
      { id: 'a', amount: 5 },
      { id: 'b', amount: 5 },
    ])
    const back = undoLast(s)
    expect(hp(back, 'a')).toBe(20)
    expect(hp(back, 'b')).toBe(20)
    expect(back.log).toHaveLength(0)
  })
})

describe('concentration', () => {
  it('DC is 10 or half the damage, whichever is higher', () => {
    expect(concentrationDc(4)).toBe(10)
    expect(concentrationDc(20)).toBe(10)
    expect(concentrationDc(21)).toBe(10)
    expect(concentrationDc(22)).toBe(11)
    expect(concentrationDc(51)).toBe(25)
  })

  it('prompts when a concentrating creature is damaged, and a failed save ends it', () => {
    let s = combat(creature('a'))
    s = setConcentrating(s, 'a', true)
    s = damageMany(s, [{ id: 'a', amount: 8 }])
    expect(s.concentrationPrompts).toHaveLength(1)
    expect(s.concentrationPrompts[0].dc).toBe(10)
    s = resolveConcentration(s, s.concentrationPrompts[0].id, false)
    expect(s.combatants[0].concentrating).toBe(false)
    expect(s.concentrationPrompts).toHaveLength(0)
  })

  it('passing keeps concentration; dropping to 0 ends it with no prompt', () => {
    let s = setConcentrating(combat(creature('a')), 'a', true)
    s = damageMany(s, [{ id: 'a', amount: 30 }])
    expect(s.combatants[0].concentrating).toBe(false)
    expect(s.concentrationPrompts).toHaveLength(0)
    s = setConcentrating(combat(creature('b')), 'b', true)
    s = damageMany(s, [{ id: 'b', amount: 2 }])
    s = resolveConcentration(s, s.concentrationPrompts[0].id, true)
    expect(s.combatants[0].concentrating).toBe(true)
  })
})

describe('turns, reminders and effects', () => {
  it('counts effects down at the end of the affected creature turn and reminds', () => {
    let s = combat(creature('a', { initiative: 15 }), creature('b', { initiative: 5 }))
    s = { ...s, activeId: 'a' }
    s = addEffect(s, 'a', { name: 'Bless', rounds: 2, remind: 'start' })
    s = endTurn(s) // a ends: 2 → 1
    expect(s.activeId).toBe('b')
    expect(s.combatants[0].effects?.[0].rounds).toBe(1)
    s = endTurn(s) // b ends, round 2, a starts → reminder
    expect(s.round).toBe(2)
    expect(s.reminders.some((r) => r.text.includes('Bless'))).toBe(true)
    s = endTurn(s) // a ends: 1 → expires
    expect(s.combatants[0].effects).toEqual([])
    s = endTurn(s)
    s = endTurn(s)
    expect(s.reminders.some((r) => r.text.includes('Bless'))).toBe(false)
  })

  it('resets movement when a turn starts and logs movement', () => {
    let s = combat(creature('a', { initiative: 15, speed: 30 }), creature('b', { initiative: 5 }))
    s = { ...s, activeId: 'a' }
    s = addMovement(s, 'a', 20)
    expect(s.combatants[0].movedFt).toBe(20)
    s = endTurn(endTurn(s))
    expect(s.combatants[0].movedFt).toBe(0)
  })

  it('reminds about conditions on the creature whose turn starts', () => {
    let s = combat(
      creature('a', { initiative: 15 }),
      creature('b', { initiative: 5, conditions: ['Poisoned'] }),
    )
    s = { ...s, activeId: 'a' }
    s = endTurn(s)
    expect(s.reminders[0].text).toContain('Poisoned')
  })

  it('turn changes can be undone', () => {
    const s0 = { ...combat(creature('a'), creature('b')), activeId: 'a' }
    const s1 = endTurn(s0)
    expect(s1.activeId).not.toBe('a')
    expect(undoLast(s1).activeId).toBe('a')
  })
})

describe('combat log', () => {
  it('undoes the newest undoable entry and leaves older ones', () => {
    let s = combat(creature('a'))
    s = damageMany(s, [{ id: 'a', amount: 3 }])
    s = healOne(s, 'a', 2)
    expect(hp(s, 'a')).toBe(19)
    s = undoLast(s)
    expect(hp(s, 'a')).toBe(17)
    expect(s.log).toHaveLength(1)
  })

  it('caps the log length', () => {
    let s = combat(creature('a'))
    for (let i = 0; i < 120; i++) s = logged(s, 'note', `n${i}`, (x) => x)
    expect(s.log.length).toBeLessThanOrEqual(80)
  })
})

describe('group rolls', () => {
  it('rolls initiative for each creature with its own Dex modifier', () => {
    const s = rollInitiativeGroup(
      combat(
        creature('Goblin 1', { initiative: null, dexMod: 2 }),
        creature('Goblin 2', { initiative: null, dexMod: 2 }),
      ),
      ['Goblin 1', 'Goblin 2'],
      { roller: fixed(10, 5) },
    )
    expect(s.combatants.map((c) => c.initiative)).toEqual([12, 7])
  })

  it('shares one roll between creatures with the same name when asked', () => {
    const s = rollInitiativeGroup(
      combat(
        creature('Goblin 1', { initiative: null, dexMod: 2 }),
        creature('Goblin 2', { initiative: null, dexMod: 2 }),
        creature('Ogre 1', { initiative: null, dexMod: -1 }),
      ),
      ['Goblin 1', 'Goblin 2', 'Ogre 1'],
      { roller: fixed(10, 3), shareByName: true },
    )
    expect(s.combatants.map((c) => c.initiative)).toEqual([12, 12, 2])
  })

  it('saves pass on meeting the DC; advantage keeps the higher die', () => {
    const cs = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]
    const r = rollSaves(cs, () => 2, 12, 'normal', fixed(10, 9))
    expect(r.map((x) => x.passed)).toEqual([true, false])
    const adv = rollSaves([cs[0]], () => 0, 15, 'advantage', fixed(4, 17))
    expect(adv[0]).toMatchObject({ die: 17, passed: true })
    const dis = rollSaves([cs[0]], () => 0, 15, 'disadvantage', fixed(4, 17))
    expect(dis[0]).toMatchObject({ die: 4, passed: false })
  })
})

describe('area templates (5 ft squares)', () => {
  const t = (
    shape: Parameters<typeof templateCells>[0]['shape'],
    sizeFt: number,
    target = { x: 20, y: 10 },
  ) => ({
    shape,
    sizeFt,
    origin: { x: 10, y: 10 },
    target,
  })

  it('a 20 ft radius sphere covers the cells within 4 squares', () => {
    const cells = templateCells(t('sphere', 20), 5)
    expect(cells).toHaveLength(49)
    expect(cells).toContainEqual({ x: 14, y: 10 })
    expect(cells).not.toContainEqual({ x: 14, y: 12 })
  })

  it('a 15 ft cube is 3 × 3 centred on the origin', () => {
    const cells = templateCells(t('cube', 15), 5)
    expect(cells).toHaveLength(9)
    expect(cells).toContainEqual({ x: 9, y: 9 })
    expect(cells).toContainEqual({ x: 11, y: 11 })
  })

  it('a 15 ft cone aimed east widens with distance and excludes the origin', () => {
    const cells = templateCells(t('cone', 15), 5)
    const at = (x: number, y: number) => cells.some((c) => c.x === x && c.y === y)
    expect(at(10, 10)).toBe(false)
    expect(at(11, 10)).toBe(true)
    expect(at(13, 10)).toBe(true)
    expect(at(13, 11)).toBe(true)
    expect(at(11, 12)).toBe(false)
    expect(at(14, 10)).toBe(false)
  })

  it('a 30 ft line is one square wide and six long', () => {
    const cells = templateCells(t('line', 30), 5)
    expect(cells).toHaveLength(6)
    expect(cells.every((c) => c.y === 10)).toBe(true)
    // Aimed diagonally it stays one square wide at the centre line.
    expect(templateCells(t('line', 30, { x: 10, y: 20 }), 5).every((c) => c.x === 10)).toBe(true)
  })

  it('lists tokens that overlap the template', () => {
    let doc = createEmptyMap({ width: 30, height: 30 })
    const place = (id: string, x: number, y: number) => {
      doc = {
        ...doc,
        props: {
          ...doc.props,
          [id]: {
            id,
            layer: 'tokens',
            defId: 'token-ally',
            x,
            y,
            rotation: 0,
            mirrored: false,
            token: defaultTokenInfo(id, 'enemy'),
          },
        },
      }
    }
    place('in', 11, 10)
    place('out', 25, 25)
    const ids = tokensInCells(doc, templateCells(t('sphere', 10), 5))
    expect(ids).toEqual(['in'])
  })
})

describe('movement cost', () => {
  const meta = (over: Partial<AssetMeta>): AssetMeta => ({
    name: 'x',
    kind: 'tile',
    category: 'terrain',
    footprint: { w: 1, h: 1 },
    blocksMovement: false,
    blocksSight: false,
    difficultTerrain: false,
    tags: [],
    source: 'test',
    ...over,
  })
  const base = () => createEmptyMap({ width: 20, height: 20 })

  it('counts straight and diagonal steps by the chosen rule', () => {
    const doc = base()
    expect(movePath(doc, { x: 0, y: 0 }, { x: 4, y: 0 }, 'five')?.feet).toBe(20)
    expect(movePath(doc, { x: 0, y: 0 }, { x: 4, y: 4 }, 'five')?.feet).toBe(20)
    expect(movePath(doc, { x: 0, y: 0 }, { x: 4, y: 4 }, 'alternating')?.feet).toBe(30)
    expect(movePath(doc, { x: 0, y: 0 }, { x: 0, y: 0 }, 'five')?.feet).toBe(0)
  })

  it('difficult terrain costs double per square', () => {
    let doc: MapDoc = { ...base(), assets: { mud: meta({ difficultTerrain: true }) } }
    doc = { ...doc, tiles: { '1,0': 'mud', '2,0': 'mud', '3,0': 'mud' } }
    // Going through three mud squares in a row costs 3 extra steps, or walks around them.
    const direct = movePath(doc, { x: 0, y: 0 }, { x: 4, y: 0 }, 'five')!
    expect(direct.feet).toBeLessThanOrEqual(30)
    const flat = movePath(base(), { x: 0, y: 0 }, { x: 4, y: 0 }, 'five')!
    expect(direct.feet).toBeGreaterThan(flat.feet - 1)
    const into = movePath(doc, { x: 0, y: 0 }, { x: 2, y: 0 }, 'five', 0)!
    // Margin 0 pins the path to row 0: (1,0) and (2,0) are both difficult → 4 steps.
    expect(into.feet).toBe(20)
  })

  it('walls block, open doors do not, and an enclosed target is unreachable', () => {
    let doc = base()
    const walls: Record<string, { door: boolean; secret: boolean }> = {}
    // A wall across the whole map at x = 5 (edge between columns 4 and 5).
    for (let y = 0; y < 20; y++) walls[edgeKey('v', 5, y)] = { door: false, secret: false }
    doc = { ...doc, walls }
    expect(movePath(doc, { x: 0, y: 5 }, { x: 8, y: 5 }, 'five')).toBeNull()
    doc = { ...doc, walls: { ...walls, [edgeKey('v', 5, 5)]: { door: true, secret: false } } }
    expect(movePath(doc, { x: 0, y: 5 }, { x: 8, y: 5 }, 'five')?.feet).toBe(40)
    doc = { ...doc, walls: { ...walls, [edgeKey('v', 5, 5)]: { door: true, secret: true } } }
    expect(movePath(doc, { x: 0, y: 5 }, { x: 8, y: 5 }, 'five')).toBeNull()
  })

  it('terrain that blocks movement forces a detour', () => {
    let doc: MapDoc = { ...base(), assets: { rock: meta({ blocksMovement: true }) } }
    const tiles: Record<string, string> = {}
    for (let y = 0; y < 6; y++) tiles[`3,${y}`] = 'rock'
    doc = { ...doc, tiles }
    const p = movePath(doc, { x: 1, y: 1 }, { x: 5, y: 1 }, 'five')!
    expect(p.feet).toBeGreaterThan(20)
    expect(p.cells.every((c) => !tiles[`${c.x},${c.y}`])).toBe(true)
  })
})
