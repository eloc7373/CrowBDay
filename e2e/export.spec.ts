import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { clickCell, dragCells, freshMap, getDoc } from './helpers'

async function download(page: Page, click: () => Promise<void>) {
  const [dl] = await Promise.all([page.waitForEvent('download'), click()])
  const path = await dl.path()
  return { name: dl.suggestedFilename(), bytes: await readFile(path!) }
}

/** PNG width/height from the IHDR chunk. */
const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) })

test.describe('Phase 4 acceptance', () => {
  test('30×20 map at 70 px exports as exactly 2100×1400 with grid lines on multiples of 70', async ({
    page,
  }) => {
    await freshMap(page, 30, 20)
    // Black, fully opaque grid on a white background makes lines easy to detect.
    await page.getByLabel('Grid opacity').fill('1')
    await page.getByRole('button', { name: 'Export map' }).click()
    const dialog = page.getByRole('dialog', { name: 'Export map' })
    await dialog.getByLabel('Background colour').fill('#ffffff')
    await expect(dialog.getByTestId('png-output')).toContainText(
      '2100 × 1400 px · 70 px per cell · untitled-map_30x20_70px.png',
    )

    const png = await download(page, () =>
      dialog.getByRole('button', { name: 'Download PNG' }).click(),
    )
    expect(png.name).toBe('untitled-map_30x20_70px.png')
    expect(pngSize(png.bytes)).toEqual({ width: 2100, height: 1400 })

    // Decode in the browser and sample pixels along row y = 35 (middle of the first row of cells).
    const samples = await page.evaluate(async (b64) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(bmp, 0, 0)
      const px = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3))
      const onLines = [0, 70, 140, 700, 2030].map((x) => px(x, 35))
      const offLines = [35, 69, 71, 105, 2065].map((x) => px(x, 35))
      const rows = [0, 70, 1330].map((y) => px(35, y))
      return { onLines, offLines, rows, last: px(2099, 35), lastRow: px(35, 1399) }
    }, png.bytes.toString('base64'))
    for (const p of [...samples.onLines, ...samples.rows, samples.last, samples.lastRow])
      expect(p).toEqual([0, 0, 0])
    for (const p of samples.offLines) expect(p).toEqual([255, 255, 255])

    // 2× doubles the cell size and the image.
    await dialog.getByLabel('Export scale').selectOption('2')
    await expect(dialog.getByTestId('png-output')).toContainText(
      '4200 × 2800 px · 140 px per cell · untitled-map_30x20_140px.png',
    )
  })

  test('map file round-trip through the UI: export JSON → import → identical map', async ({
    page,
  }) => {
    await freshMap(page, 16, 12)
    await page.locator('[data-testid="asset-results"] [data-asset="grass"]').click()
    await page.keyboard.press('g')
    await clickCell(page, 1.5, 1.5)
    await page.locator('[data-testid="asset-results"] [data-asset="token-monster"]').click()
    await clickCell(page, 5.5, 5.5)
    await page.keyboard.press('w')
    await dragCells(page, [2, 2], [8, 2])
    const before = await getDoc(page)

    await page.getByRole('button', { name: 'Export map' }).click()
    const dialog = page.getByRole('dialog', { name: 'Export map' })
    await dialog.getByRole('tab', { name: 'Map file (JSON)' }).click()
    const file = await download(page, () =>
      dialog.getByRole('button', { name: /Download .*\.dmtk-map\.json/ }).click(),
    )
    expect(file.name).toBe('untitled-map.dmtk-map.json')
    const pkg = JSON.parse(file.bytes.toString('utf8'))
    expect(pkg).toMatchObject({ format: 'dmtk-map', version: 1, width: 16, height: 12 })
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()

    // Import into a different map; because the id already exists it comes in as a copy.
    await freshMap(page, 5, 5)
    await page.getByRole('button', { name: 'Maps' }).click()
    const maps = page.getByRole('dialog', { name: 'Maps' })
    await maps
      .getByLabel('Map file')
      .setInputFiles({ name: file.name, mimeType: 'application/json', buffer: file.bytes })
    await expect(maps).toBeHidden()
    const after = await getDoc(page)
    const strip = (d: Record<string, unknown>) => ({ ...d, id: '', name: '', updatedAt: '' })
    expect(strip(after)).toEqual(strip(before))
    expect(after.name).toBe('Untitled map (imported)')
  })

  test('invalid map files show readable errors', async ({ page }) => {
    await freshMap(page, 5, 5)
    await page.getByRole('button', { name: 'Maps' }).click()
    const maps = page.getByRole('dialog', { name: 'Maps' })
    const bad = { format: 'dmtk-map', version: 1, name: 'x', tiles: { '0,0': 3 } }
    await maps.getByLabel('Map file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bad)),
    })
    const alert = maps.getByRole('alert')
    await expect(alert).toContainText('could not be imported')
    await expect(alert).toContainText('grid: is required.')
    await expect(alert).toContainText('tiles.0,0: must be string.')
  })

  test('print PDF and Foundry scene download', async ({ page }) => {
    await freshMap(page, 20, 10)
    await page.keyboard.press('w')
    await dragCells(page, [1, 1], [6, 1])
    await page.getByRole('button', { name: 'Export map' }).click()
    const dialog = page.getByRole('dialog', { name: 'Export map' })
    await dialog.getByRole('tab', { name: 'Print (PDF)' }).click()
    await dialog.getByLabel('Paper size').selectOption('a4')
    const pdf = await download(page, () =>
      dialog.getByRole('button', { name: 'Download PDF' }).click(),
    )
    expect(pdf.name).toBe('untitled-map_print.pdf')
    expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.bytes.length).toBeGreaterThan(5000)

    await dialog.getByRole('tab', { name: 'Foundry scene (experimental)' }).click()
    const scene = await download(page, () =>
      dialog.getByRole('button', { name: 'Scene JSON only' }).click(),
    )
    const json = JSON.parse(scene.bytes.toString('utf8'))
    expect(json).toMatchObject({ width: 1400, height: 700, grid: { size: 70 } })
    expect(json.walls).toEqual([
      { c: [70, 70, 420, 70], door: 0, ds: 0, move: 20, sight: 20, light: 20, sound: 20 },
    ])
  })
})
