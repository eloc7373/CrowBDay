import { expect, test, type Page } from '@playwright/test'
import { clickCell, dragCells, freshMap } from './helpers'

interface Cbt {
  id: string
  name: string
  hp: { current: number; max: number; temp: number } | null
  movedFt?: number
  link?: { tokenId: string } | null
  speed?: number | null
}

const combat = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as {
      __dmtk: { combat: { getState(): { state: Record<string, unknown> } } }
    }
    return JSON.parse(JSON.stringify(w.__dmtk.combat.getState().state)) as {
      combatants: Cbt[]
      activeId: string | null
      log: { text: string }[]
    }
  })

/** Patches the first/nth combatant through the store (the board UI is not open on the map page). */
const patchCombatant = (
  page: Page,
  index: number,
  patch: Record<string, unknown>,
  active = false,
) =>
  page.evaluate(
    ([i, p, a]) => {
      const w = window as unknown as {
        __dmtk: {
          combat: {
            getState(): {
              state: { combatants: { id: string }[] }
              update(fn: (s: Record<string, unknown>) => Record<string, unknown>): void
            }
          }
        }
      }
      const st = w.__dmtk.combat.getState()
      const id = st.state.combatants[i as number].id
      st.update((s) => ({
        ...s,
        activeId: a ? id : s.activeId,
        combatants: (s.combatants as { id: string }[]).map((c) =>
          c.id === id ? { ...c, ...(p as object) } : c,
        ),
      }))
    },
    [index, patch, active] as const,
  )

async function placeToken(page: Page, asset: string, u: number, v: number) {
  await page.getByTestId('asset-results').locator(`[data-asset="${asset}"]`).click()
  await clickCell(page, u, v)
}

test.describe('Phase 5B Combat Mode', () => {
  test('tokens placed with the option on join initiative, linked both ways', async ({ page }) => {
    await freshMap(page, 20, 12)
    await page.getByLabel('Add new creature tokens to initiative').check()
    await placeToken(page, 'token-pc', 2.5, 2.5)
    await placeToken(page, 'token-monster', 6.5, 2.5)
    const s = await combat(page)
    expect(s.combatants.map((c) => c.name)).toEqual(expect.arrayContaining(['PC 1', 'Monster 1']))
    expect(s.combatants.every((c) => c.link?.tokenId)).toBe(true)

    // Selecting a token on the map selects its creature in the tracker (and the reverse).
    await page.keyboard.press('v')
    await page.keyboard.press('Escape')
    await clickCell(page, 6.5, 2.5)
    await expect(page.getByTestId('token-linked')).toBeVisible()
    const sel = await page.evaluate(() => {
      const w = window as unknown as {
        __dmtk: { combat: { getState(): { state: { selectedId: string | null } } } }
      }
      return w.__dmtk.combat.getState().state.selectedId
    })
    expect(s.combatants.find((c) => c.id === sel)?.name).toBe('Monster 1')
  })

  test('moving the active token tracks feet used against speed', async ({ page }) => {
    await freshMap(page, 20, 12)
    await page.getByLabel('Add new creature tokens to initiative').check()
    await placeToken(page, 'token-pc', 1.5, 2.5)
    await patchCombatant(page, 0, { speed: 30 }, true)
    await page.keyboard.press('v')
    // Select the token, then drag it 4 squares right.
    await clickCell(page, 1.5, 2.5)
    await dragCells(page, [1.5, 2.5], [5.5, 2.5])
    let c = (await combat(page)).combatants[0]
    expect(c.movedFt).toBe(20)
    // Another 4 squares goes over the 30 ft speed and flashes a warning.
    await dragCells(page, [5.5, 2.5], [9.5, 2.5])
    c = (await combat(page)).combatants[0]
    expect(c.movedFt).toBe(40)
    await expect(page.getByText('over speed')).toBeVisible()
    expect((await combat(page)).log.some((l) => l.text.includes('moves 20 ft'))).toBe(true)
  })

  test('area template lists tokens inside, applies half damage on a save, and can be undone', async ({
    page,
  }) => {
    await freshMap(page, 20, 12)
    await page.getByLabel('Add new creature tokens to initiative').check()
    await placeToken(page, 'token-monster', 5.5, 5.5)
    await placeToken(page, 'token-monster', 6.5, 5.5)
    await placeToken(page, 'token-monster', 15.5, 9.5)
    await patchCombatant(page, 0, { hp: { current: 20, max: 20, temp: 0 } })
    await patchCombatant(page, 1, { hp: { current: 20, max: 20, temp: 0 } })
    await patchCombatant(page, 2, { hp: { current: 20, max: 20, temp: 0 } })

    await page.getByLabel('Template shape').selectOption('sphere')
    await page.getByLabel('Template size').fill('10')
    await page.getByRole('button', { name: 'Place template (A)' }).click()
    await clickCell(page, 5.5, 5.5)
    const result = page.getByTestId('template-result')
    await expect(result).toContainText('2 tokens inside')
    await expect(result.getByTestId('area-target')).toHaveCount(2)

    await result.getByLabel('Damage amount').fill('9')
    await result.getByLabel('Monster 2 saved').check()
    await result.getByRole('button', { name: 'Apply damage' }).click()
    const s = await combat(page)
    const hp = (n: string) => s.combatants.find((c) => c.name === n)!.hp!.current
    expect(hp('Monster 1')).toBe(11)
    expect(hp('Monster 2')).toBe(16)
    expect(hp('Monster 3')).toBe(20)

    // Undo from the DM Board combat log restores both.
    await page.goto('/#/board')
    await page.getByRole('button', { name: 'Undo last combat action' }).click()
    expect((await page.getByTestId('hp').allInnerTexts()).every((t) => t === '20/20')).toBe(true)
  })

  test('Escape clears the template', async ({ page }) => {
    await freshMap(page, 20, 12)
    await page.keyboard.press('a')
    await clickCell(page, 5.5, 5.5)
    await expect(page.getByTestId('template-result')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('template-result')).toHaveCount(0)
  })
})

test.describe('Phase 5B board features', () => {
  test('concentration prompt appears with the right DC and a failed save ends it', async ({
    page,
  }) => {
    await page.goto('/#/board')
    await page.getByLabel('Creature name').fill('Wizard')
    await page.getByLabel('Max HP').fill('40')
    await page.getByRole('button', { name: 'Add creature' }).click()
    await page.getByRole('button', { name: 'Toggle concentration for Wizard' }).click()
    await page.getByLabel('HP change for Wizard').fill('30')
    await page.getByRole('button', { name: 'Damage Wizard' }).click()
    const prompt = page.getByTestId('concentration-prompt')
    await expect(prompt).toContainText('DC 15')
    await prompt.getByRole('button', { name: 'Failed' }).click()
    await expect(prompt).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Toggle concentration for Wizard' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('log-entry').first()).toContainText('loses concentration')
  })

  test('manual initiative shows who is next and records turn notes', async ({ page }) => {
    await page.goto('/#/board')
    for (const [n, initiative] of [['Orc A', '14'], ['Orc B', '8']]) {
      await page.getByLabel('Creature name').fill(n)
      await page.getByRole('textbox', { name: 'Initiative', exact: true }).fill(initiative)
      await page.getByRole('button', { name: 'Add creature' }).click()
    }
    await expect(page.getByText('First up: Orc A')).toBeVisible()
    await page.getByRole('button', { name: 'Next turn' }).click()
    await expect(page.getByText(/Next up: Orc B/)).toBeVisible()
    const log = page.getByTestId('card-log')
    await log.getByLabel('Combat move or action').fill('Orc A attacks the gate')
    await log.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByTestId('log-entry').first()).toContainText('Orc A attacks the gate')
  })

  test('area damage card applies half damage to those who saved', async ({ page }) => {
    await page.goto('/#/board')
    for (const n of ['Imp', 'Bat']) {
      await page.getByLabel('Creature name').fill(n)
      await page.getByLabel('Max HP').fill('20')
      await page.getByRole('button', { name: 'Add creature' }).click()
    }
    const area = page.getByTestId('card-area')
    await area.getByLabel('Effect name').fill('Fireball')
    await area.getByLabel('Damage amount').fill('11')
    await area.getByLabel('Bat saved').check()
    await area.getByRole('button', { name: 'Apply damage' }).click()
    const hps = await page.getByTestId('hp').allInnerTexts()
    expect(hps.sort()).toEqual(['15/20', '9/20'])
    await expect(page.getByTestId('log-entry').first()).toContainText('Fireball')
  })

  test('turns advance and wrap into a new round', async ({ page }) => {
    await page.goto('/#/board')
    for (const [n, init] of [
      ['Fast', '20'],
      ['Slow', '5'],
    ]) {
      await page.getByLabel('Creature name').fill(n)
      await page.getByRole('textbox', { name: 'Initiative', exact: true }).fill(init)
      await page.getByRole('button', { name: 'Add creature' }).click()
    }
    await page.getByRole('button', { name: 'Next turn' }).click() // Fast is active
    await page.getByRole('button', { name: 'Next turn' }).click() // Slow starts
    await page.getByRole('button', { name: 'Next turn' }).click() // Fast starts again
    expect(await page.getByTestId('round').innerText()).toContain('Round 2')
  })
})
