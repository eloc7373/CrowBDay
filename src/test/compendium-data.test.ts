import { describe, expect, it } from 'vitest'
import { validateCompendium } from '../board/compendium/store'
import rawText from '../../public/monster-manual-compendium.json?raw'

const raw = JSON.parse(rawText)
const pageImages = new Set(Object.keys(import.meta.glob('/public/monster-manual-2014/*.jpg', { query: '?url' })))

describe('bundled Monster Manual (2014) compendium', () => {
  const result = validateCompendium(raw)

  it('imports every monster without errors', () => {
    expect(result.errors).toEqual([])
    expect(result.monsters.length).toBe(raw.monsters.length)
    expect(new Set(result.monsters.map((m) => m.name)).size).toBe(result.monsters.length)
  })

  it('has a complete stat block for each monster', () => {
    for (const m of result.monsters) {
      expect(m.size, m.name).toBeTruthy()
      expect(m.type, m.name).toBeTruthy()
      expect(m.speed, m.name).toBeTruthy()
      expect(m.challenge, m.name).toBeDefined()
      expect(Object.keys(m.abilityScores ?? {}), m.name).toHaveLength(6)
      expect(m.bookPage, m.name).toBeGreaterThan(0)
    }
  })

  it('points every monster at existing page images', () => {
    for (const m of result.monsters) {
      expect(m.imageUrls?.length, m.name).toBeGreaterThan(0)
      for (const url of m.imageUrls ?? []) expect(pageImages.has(`/public${url}`), `${m.name} ${url}`).toBe(true)
    }
  })

  it('matches the printed Aboleth stat block', () => {
    const a = result.monsters.find((m) => m.name === 'Aboleth')
    expect(a).toMatchObject({ ac: 17, hp: 135, hpFormula: '18d10 + 36', initiativeBonus: -1, challenge: '10', bookPage: 13, imagePage: 14 })
    expect(a?.abilityScores).toEqual({ str: 21, dex: 9, con: 15, int: 18, wis: 15, cha: 18 })
  })
})
