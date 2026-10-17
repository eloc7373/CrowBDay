import type { Page } from '@playwright/test'

/** Snapshot of the map document exposed by the dev-only window.__dmtk hook. */
export async function getDoc(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __dmtk: { map: { getState(): { doc: unknown } } } }
    return JSON.parse(JSON.stringify(w.__dmtk.map.getState().doc))
  })
}

export async function getEditor(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __dmtk: { editor: { getState(): Record<string, unknown> } } }
    const s = w.__dmtk.editor.getState()
    return JSON.parse(
      JSON.stringify({
        tool: s.tool,
        brushSize: s.brushSize,
        rotation: s.rotation,
        mirrored: s.mirrored,
        helpOpen: s.helpOpen,
        selection: s.selection,
      }),
    )
  })
}

export async function historyLength(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __dmtk: { map: { getState(): { past: unknown[]; future: unknown[] } } }
    }
    const s = w.__dmtk.map.getState()
    return { past: s.past.length, future: s.future.length }
  })
}

/** Page coordinates of a point given in cell units (e.g. 3.5, 2.5 = centre of D3). */
export async function cellToPage(page: Page, u: number, v: number) {
  const box = await page.getByTestId('map-canvas').boundingBox()
  const { view, cell } = await page.evaluate(() => {
    const w = window as unknown as {
      __dmtk: {
        editor: { getState(): { view: { x: number; y: number; scale: number } } }
        map: { getState(): { doc: { grid: { cellSize: number } } } }
      }
    }
    return {
      view: w.__dmtk.editor.getState().view,
      cell: w.__dmtk.map.getState().doc.grid.cellSize,
    }
  })
  return { x: box!.x + view.x + u * cell * view.scale, y: box!.y + view.y + v * cell * view.scale }
}

export async function clickCell(page: Page, u: number, v: number) {
  const p = await cellToPage(page, u, v)
  await page.mouse.click(p.x, p.y)
}

export async function dragCells(
  page: Page,
  from: [number, number],
  to: [number, number],
  steps = 12,
) {
  const a = await cellToPage(page, ...from)
  const b = await cellToPage(page, ...to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps })
  await page.mouse.up()
}

export async function freshMap(page: Page, width = 30, height = 20) {
  await page.goto('/#/map')
  await page.getByTestId('map-canvas').waitFor()
  await page.getByRole('button', { name: 'New map' }).click()
  const dialog = page.getByRole('dialog', { name: 'New map' })
  await dialog.getByLabel('Width in cells').fill(String(width))
  await dialog.getByLabel('Height in cells').fill(String(height))
  await dialog.getByRole('button', { name: 'Create map' }).click()
  await page.waitForTimeout(150) // fit-to-screen runs on the next frame
}
