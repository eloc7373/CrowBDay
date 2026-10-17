import { expect, test, type Page } from '@playwright/test'
import { cellToPage, clickCell, freshMap, getDoc, getEditor } from './helpers'

const results = (page: Page) => page.getByTestId('asset-results')

/** Builds a 4×2 sheet of 32 px tiles in the browser; the last cell is transparent. */
async function makeSheet(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 64
    const ctx = c.getContext('2d')!
    const colors = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#f97316']
    colors.forEach((col, i) => {
      ctx.fillStyle = col
      ctx.fillRect((i % 4) * 32, Math.floor(i / 4) * 32, 32, 32)
    })
    return c.toDataURL('image/png').split(',')[1]
  })
  return Buffer.from(b64, 'base64')
}

async function clearTilesets(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('dm-toolkit')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('tilesets')) return resolve()
          const tx = db.transaction('tilesets', 'readwrite')
          tx.objectStore('tilesets').clear()
          tx.oncomplete = () => resolve()
        }
        req.onerror = () => resolve()
      }),
  )
}

test.describe('Phase 2 acceptance', () => {
  test('all categories are populated with placeholder art', async ({ page }) => {
    await freshMap(page)
    for (const [cat, expected] of [
      ['Terrain', 12],
      ['Dungeon', 7],
      ['Props', 14],
      ['Town', 6],
      ['Tokens', 4],
    ] as const) {
      await page
        .getByRole('group', { name: 'Category filter' })
        .getByRole('button', { name: cat, exact: true })
        .click()
      await expect(results(page).locator('[data-asset]')).toHaveCount(expected)
      // Thumbnails are rendered images, not empty boxes.
      const src = await results(page).locator('img').first().getAttribute('src')
      expect(src).toMatch(/^data:image\/png;base64,/)
    }
  })

  test('searching "stone" returns the stone floor and related tiles', async ({ page }) => {
    await freshMap(page)
    await page.getByLabel('Search assets').fill('stone')
    const ids = await results(page)
      .locator('[data-asset]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-asset')))
    expect(ids[0]).toBe('stone-floor')
    expect(ids).toEqual(
      expect.arrayContaining(['rubble', 'rock', 'pillar', 'cobblestone', 'statue']),
    )
    expect(ids).not.toContain('grass')
    // Category chips narrow the results further.
    await page
      .getByRole('group', { name: 'Category filter' })
      .getByRole('button', { name: 'Terrain', exact: true })
      .click()
    const narrowed = await results(page)
      .locator('[data-asset]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-asset')))
    expect(narrowed).toEqual(['stone-floor', 'rubble', 'rock'])
  })

  test('dropping a custom PNG via the import dialog makes its tiles available', async ({
    page,
  }) => {
    await freshMap(page, 12, 8)
    await clearTilesets(page)
    const png = await makeSheet(page)
    await page.getByRole('button', { name: 'Import tileset' }).click()
    const dialog = page.getByRole('dialog', { name: 'Tilesets' })
    await dialog
      .getByLabel('Tileset files')
      .setInputFiles({ name: 'test_sheet.png', mimeType: 'image/png', buffer: png })
    // 128×64 auto-guesses 64 px tiles; switch to 32 px.
    await expect(dialog.getByText('2 columns × 1 rows = 2 cells')).toBeVisible({ timeout: 5000 })
    await dialog.getByLabel('Tile size').fill('32')
    await expect(dialog.getByText('4 columns × 2 rows = 8 cells')).toBeVisible()
    await dialog.getByRole('button', { name: 'Install tileset' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status')).toContainText('Installed 7 assets from "test sheet"')

    // The new tiles are searchable and paintable; the transparent cell was skipped.
    await page.getByLabel('Search assets').fill('test sheet')
    await expect(results(page).locator('[data-asset^="test-sheet:"]')).toHaveCount(7)
    await results(page).locator('[data-asset="test-sheet:t0"]').click()
    await clickCell(page, 2.5, 2.5)
    let doc = await getDoc(page)
    expect(doc.tiles['2,2']).toBe('test-sheet:t0')
    expect(doc.assets['test-sheet:t0']).toMatchObject({ kind: 'tile', source: 'test sheet' })

    // Installed tilesets survive a reload, and the map still references them.
    await page.waitForTimeout(1200)
    await page.reload()
    await page.getByTestId('map-canvas').waitFor()
    await page.getByLabel('Search assets').fill('test sheet')
    await expect(results(page).locator('[data-asset^="test-sheet:"]')).toHaveCount(7)
    doc = await getDoc(page)
    expect(doc.tiles['2,2']).toBe('test-sheet:t0')
  })

  test('tileset.json import with named tiles, a multi-cell prop and flags', async ({ page }) => {
    await freshMap(page, 12, 8)
    await clearTilesets(page)
    const png = await makeSheet(page)
    const json = {
      format: 'dmtk-tileset@1',
      name: 'JSON Set',
      tileSize: 32,
      columns: 4,
      rows: 2,
      license: 'CC0-1.0',
      tiles: [
        { id: 'lava-rock', name: 'Lava rock', index: 0, variants: [1], tags: ['hazard'] },
        {
          id: 'wagon',
          name: 'Wagon',
          kind: 'prop',
          category: 'town',
          index: 4,
          footprint: [2, 1],
          blocksMovement: true,
        },
      ],
    }
    await page.getByRole('button', { name: 'Import tileset' }).click()
    const dialog = page.getByRole('dialog', { name: 'Tilesets' })
    await dialog.getByLabel('Tileset files').setInputFiles([
      { name: 'sheet.png', mimeType: 'image/png', buffer: png },
      {
        name: 'tileset.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(json)),
      },
    ])
    await expect(dialog.getByText('"JSON Set" with 2 tile entries.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Install tileset' }).click()
    await expect(dialog).toBeHidden()

    await page.getByLabel('Search assets').fill('wagon')
    await results(page).locator('[data-asset="json-set:wagon"]').click()
    expect((await getEditor(page)).tool).toBe('stamp')
    await clickCell(page, 5.5, 3.5)
    const doc = await getDoc(page)
    const wagon = Object.values(doc.props as Record<string, { defId: string; x: number }>).find(
      (p) => p.defId === 'json-set:wagon',
    )
    expect(wagon).toBeDefined()
    expect(doc.assets['json-set:wagon']).toMatchObject({
      footprint: { w: 2, h: 1 },
      blocksMovement: true,
    })
  })

  test('invalid tileset.json shows readable errors and installs nothing', async ({ page }) => {
    await freshMap(page)
    const png = await makeSheet(page)
    await page.getByRole('button', { name: 'Import tileset' }).click()
    const dialog = page.getByRole('dialog', { name: 'Tilesets' })
    await dialog.getByLabel('Tileset files').setInputFiles([
      { name: 'sheet.png', mimeType: 'image/png', buffer: png },
      {
        name: 'tileset.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({ name: 'Broken', tileSize: 32, tiles: [{ id: 'x', index: 99 }] }),
        ),
      },
    ])
    await dialog.getByRole('button', { name: 'Install tileset' }).click()
    await expect(dialog.getByRole('alert')).toContainText('tiles[0].index: 99 is outside the sheet')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
  })

  test('drag an asset onto the canvas; recently used list', async ({ page }) => {
    await freshMap(page, 12, 8)
    const target = await cellToPage(page, 4.5, 3.5)
    const box = (await page.getByTestId('map-canvas').boundingBox())!
    await results(page)
      .locator('[data-asset="barrel"]')
      .dragTo(page.getByTestId('map-canvas'), {
        targetPosition: { x: target.x - box.x, y: target.y - box.y },
      })
    let doc = await getDoc(page)
    const barrel = Object.values(
      doc.props as Record<string, { defId: string; x: number; y: number }>,
    )[0]
    expect(barrel).toMatchObject({ defId: 'barrel', x: 4, y: 3 })

    await results(page)
      .locator('[data-asset="lava"]')
      .dragTo(page.getByTestId('map-canvas'), {
        targetPosition: { x: target.x - box.x, y: target.y - box.y },
      })
    doc = await getDoc(page)
    expect(doc.tiles['4,3']).toBe('lava')

    const recent = page.getByTestId('recent-assets')
    await expect(recent.locator('[data-asset]').first()).toHaveAttribute('data-asset', 'lava')
    await expect(recent.locator('[data-asset="barrel"]')).toHaveCount(1)
  })

  test('tokens carry creature data, scale with size, and edits are undoable', async ({ page }) => {
    await freshMap(page, 12, 8)
    await results(page).locator('[data-asset="token-monster"]').click()
    await page.getByLabel('Token size').selectOption('large')
    await clickCell(page, 4.5, 4.5)
    let doc = await getDoc(page)
    const id = Object.keys(doc.props)[0]
    expect(doc.props[id].token).toMatchObject({
      name: 'Monster 1',
      side: 'enemy',
      size: 'large',
      hp: null,
    })

    await page.keyboard.press('v')
    await clickCell(page, 4.5, 4.5)
    const panel = page.getByTestId('token-panel')
    await panel.getByLabel('Name', { exact: true }).fill('Ogre')
    await panel.getByLabel('Name', { exact: true }).press('Enter')
    await panel.getByLabel('Max HP').fill('59')
    await panel.getByLabel('Max HP').press('Enter')
    await panel.getByLabel('AC').fill('11')
    await panel.getByLabel('AC').press('Enter')
    await panel.getByLabel('Damage or healing amount').fill('20')
    await panel.getByRole('button', { name: 'Damage' }).click()
    doc = await getDoc(page)
    expect(doc.props[id].token).toMatchObject({
      name: 'Ogre',
      ac: 11,
      hp: { current: 39, max: 59, temp: 0 },
    })

    await page.getByTestId('map-canvas').hover()
    await page.keyboard.press('Control+z')
    expect((await getDoc(page)).props[id].token.hp.current).toBe(59)
  })
})
