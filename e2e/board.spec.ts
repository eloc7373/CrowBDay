import { expect, test, type Page } from '@playwright/test'

async function openBoard(page: Page) {
  await page.goto('/#/board')
  await expect(page.getByRole('heading', { name: 'Combat tracker' })).toBeVisible()
}

async function addCreature(page: Page, name: string, init: string) {
  await page.getByLabel('Creature name').fill(name)
  await page.getByRole('textbox', { name: 'Initiative', exact: true }).fill(init)
  await page.getByRole('button', { name: 'Add creature' }).click()
}

test.describe('Phase 5 DM Board', () => {
  test('renders every card without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await openBoard(page)
    for (const t of ['Conditions', 'Rolling stays at the table', 'Session notes', 'Rules', 'Quick tools'])
      await expect(page.getByRole('heading', { name: t })).toBeVisible()
    await expect(page.getByText(/Roll dice at the table or with your preferred external roller/)).toBeVisible()
    expect(errors).toEqual([])
  })

  test('initiative orders ties and survives a refresh', async ({ page }) => {
    await openBoard(page)
    await addCreature(page, 'Alpha', '12')
    await addCreature(page, 'Bravo', '18')
    await addCreature(page, 'Charlie', '12')
    const names = () => page.getByTestId('combatant').allInnerTexts()
    const before = await names()
    expect(before[0]).toContain('Bravo')
    expect(before).toHaveLength(3)
    await page.waitForTimeout(1500)
    await page.reload()
    await expect(page.getByTestId('combatant')).toHaveCount(3)
    expect(await names()).toEqual(before)
  })

  test('saved characters can be added to the combat tracker', async ({ page }) => {
    await openBoard(page)
    await page.getByRole('button', { name: 'Player Sheets' }).click()
    await page.getByLabel('Character name *').fill('Mira')
    await page.getByLabel('Player name').fill('Will')
    await page.getByLabel('Class / subclass').fill('Ranger')
    await page.getByLabel('Max HP').fill('28')
    await page.getByRole('button', { name: 'Save player character' }).click()
    await page.getByRole('button', { name: 'Add to initiative' }).click()
    await expect(page.getByTestId('combatant').filter({ hasText: 'Mira' })).toBeVisible()
    await expect(page.getByTestId('hp')).toHaveText('28/28')
  })

  test('dice are rolled outside the toolkit', async ({ page }) => {
    await openBoard(page)
    await expect(page.getByLabel('Dice expression')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Roll', exact: true })).toHaveCount(0)
  })

  test('search finds sample rules by title, and Ctrl+K opens it', async ({ page }) => {
    await openBoard(page)
    await page.keyboard.press('Control+k')
    const input = page.getByRole('combobox', { name: 'Search rules, conditions and spells' })
    await expect(input).toBeVisible()
    await input.fill('prone')
    await expect(
      page.getByRole('listbox', { name: 'Search results' }).getByRole('option').first(),
    ).toBeVisible()
  })

  test('notes autosave and reload in a new page', async ({ context, page }) => {
    await openBoard(page)
    await page.getByLabel('New note').click()
    await page.getByLabel('Note title').fill('Persist me')
    await page.getByLabel('Note text (markdown)').fill('hello **world**')
    await page.waitForTimeout(2600)
    await page.close()
    const page2 = await context.newPage()
    await openBoard(page2)
    await expect(page2.getByLabel('Notes').getByText('Persist me')).toBeVisible()
  })
})
