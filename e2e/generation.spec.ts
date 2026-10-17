import { expect, test } from '@playwright/test'
import { clickCell, freshMap, getDoc, historyLength } from './helpers'

test.describe('Phase 3 acceptance', () => {
  test('generate a dungeon from a typed seed; same seed reproduces it; undo restores the map', async ({ page }) => {
    await freshMap(page, 20, 15)
    await page.locator('[data-testid="asset-results"] [data-asset="grass"]').click()
    await clickCell(page, 3.5, 3.5)
    const before = await getDoc(page)

    const open = async () => {
      await page.getByRole('button', { name: 'Generate map' }).click()
      const dialog = page.getByRole('dialog', { name: 'Generate map' })
      await dialog.getByRole('radio', { name: 'Dungeon' }).click()
      await dialog.getByLabel('Seed', { exact: true }).fill('crypt-of-e2e')
      await dialog.getByLabel('Width', { exact: true }).fill('36')
      await dialog.getByLabel('Height', { exact: true }).fill('28')
      await expect(dialog.getByTestId('generate-summary')).toContainText('36×28')
      return dialog
    }

    let dialog = await open()
    await dialog.getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(dialog).toBeHidden()
    const first = await getDoc(page)
    expect(first.seed).toBe('crypt-of-e2e')
    expect(first.width).toBe(36)
    expect(Object.keys(first.tiles)).toHaveLength(36 * 28)
    expect(Object.values(first.notes).some((n) => (n as { text: string }).text === 'Entrance')).toBe(true)
    await expect(page.getByTestId('map-seed')).toHaveText('crypt-of-e2e')
    expect((await historyLength(page)).past).toBe(2) // paint + generate

    // One undo step returns the exact prior map.
    await page.getByTestId('map-canvas').hover()
    await page.keyboard.press('Control+z')
    expect(await getDoc(page)).toEqual(before)

    // Same seed + params → identical layout.
    dialog = await open()
    await dialog.getByRole('button', { name: 'Generate', exact: true }).click()
    const second = await getDoc(page)
    expect(second.tiles).toEqual(first.tiles)
    expect(second.walls).toEqual(first.walls)
  })

  test('each generator previews and applies; overlay keeps the map size', async ({ page }) => {
    await freshMap(page, 30, 20)
    for (const name of ['Cave', 'Tavern / building', 'Village / town']) {
      await page.getByRole('button', { name: 'Generate map' }).click()
      const dialog = page.getByRole('dialog', { name: 'Generate map' })
      await dialog.getByRole('radio', { name }).click()
      await dialog.getByRole('button', { name: 'New random seed' }).click()
      await dialog.getByLabel('Overlay on the current map').check()
      await expect(dialog.getByLabel('Generated map preview')).toBeVisible()
      await dialog.getByRole('button', { name: 'Generate', exact: true }).click()
      await expect(dialog).toBeHidden()
      const doc = await getDoc(page)
      expect(doc.width).toBe(30)
      expect(doc.height).toBe(20)
    }
    expect((await historyLength(page)).past).toBe(3)
  })
})
