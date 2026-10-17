import { expect, test } from '@playwright/test'
import {
  cellToPage,
  clickCell,
  dragCells,
  freshMap,
  getDoc,
  getEditor,
  historyLength,
} from './helpers'

test.describe('Phase 1 acceptance', () => {
  test('create 30×20, paint, stamp, wall + door; undo to blank; redo forward', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await freshMap(page, 30, 20)
    const blank = await getDoc(page)
    expect(blank.width).toBe(30)
    expect(blank.height).toBe(20)
    expect(Object.keys(blank.tiles)).toHaveLength(0)

    // Paint a stroke of grass with a 2-cell brush.
    await page.locator('[data-testid="asset-results"] [data-asset="grass"]').click()
    await page.keyboard.press(']')
    await dragCells(page, [2.5, 2.5], [10.5, 6.5])
    // Fill the rest of the map with stone (one undo step).
    await page.locator('[data-testid="asset-results"] [data-asset="stone-floor"]').click()
    await page.keyboard.press('g')
    await clickCell(page, 25.5, 15.5)

    // Stamp a 2×2 tree, rotated table.
    await page.locator('[data-testid="asset-results"] [data-asset="tree"]').click()
    await clickCell(page, 15.5, 10.5)
    await page.locator('[data-testid="asset-results"] [data-asset="table"]').click()
    await page.keyboard.press('r')
    await clickCell(page, 20.5, 4.5)

    // Wall along the top of row 8 from column 3 to 9, then turn one edge into a door.
    await page.keyboard.press('w')
    await dragCells(page, [3, 8], [9, 8])
    await page.getByRole('radio', { name: 'Door', exact: true }).click()
    await clickCell(page, 5.5, 8.02)

    const final = await getDoc(page)
    expect(Object.keys(final.tiles)).toHaveLength(600)
    expect(Object.values(final.tiles).filter((t) => t === 'grass').length).toBeGreaterThan(10)
    const props = Object.values(final.props) as { defId: string; rotation: number }[]
    expect(props.map((p) => p.defId).sort()).toEqual(['table', 'tree'])
    expect(props.find((p) => p.defId === 'table')!.rotation).toBe(90)
    expect(Object.keys(final.walls)).toHaveLength(6)
    expect(final.walls['h:5,8']).toEqual({ door: true, secret: false })
    expect((await historyLength(page)).past).toBe(6) // stroke, fill, tree, table, wall, door

    // Undo everything with the keyboard → identical to the blank map.
    const canvas = page.getByTestId('map-canvas')
    await canvas.hover()
    for (let i = 0; i < 6; i++) await page.keyboard.press('Control+z')
    expect(await getDoc(page)).toEqual(blank)
    expect(await historyLength(page)).toEqual({ past: 0, future: 6 })

    // Redo everything (mix of Ctrl+Shift+Z and Ctrl+Y) → identical to the final map.
    for (let i = 0; i < 3; i++) await page.keyboard.press('Control+Shift+z')
    for (let i = 0; i < 3; i++) await page.keyboard.press('Control+y')
    expect(await getDoc(page)).toEqual(final)
    expect(errors).toEqual([])
  })

  test('all keyboard shortcuts work and are listed in the help dialog', async ({ page }) => {
    await freshMap(page, 30, 20)
    const tools: Record<string, string> = {
      b: 'brush',
      g: 'fill',
      e: 'eraser',
      r: 'rect',
      o: 'ellipse',
      s: 'stamp',
      w: 'wall',
      v: 'select',
      m: 'measure',
      h: 'pan',
      t: 'label',
    }
    for (const [key, tool] of Object.entries(tools)) {
      await page.keyboard.press(key)
      expect((await getEditor(page)).tool, `key ${key}`).toBe(tool)
    }

    // Brush size [ ] clamps to 1..8.
    await page.keyboard.press('b')
    for (let i = 0; i < 10; i++) await page.keyboard.press(']')
    expect((await getEditor(page)).brushSize).toBe(8)
    for (let i = 0; i < 10; i++) await page.keyboard.press('[')
    expect((await getEditor(page)).brushSize).toBe(1)

    // 1–5 toggle layer visibility.
    const layers = ['terrain', 'walls', 'objects', 'tokens', 'notes']
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press(String(i + 1))
      expect((await getDoc(page)).layers[layers[i]].visible).toBe(false)
      await page.keyboard.press(String(i + 1))
      expect((await getDoc(page)).layers[layers[i]].visible).toBe(true)
    }

    // Ctrl+G toggles the grid.
    await page.keyboard.press('Control+g')
    expect((await getDoc(page)).grid.visible).toBe(false)
    await page.keyboard.press('Control+g')
    expect((await getDoc(page)).grid.visible).toBe(true)

    // Stamp: R rotates, F mirrors (instead of switching tool).
    await page.keyboard.press('s')
    await page.keyboard.press('r')
    await page.keyboard.press('f')
    expect(await getEditor(page)).toMatchObject({ tool: 'stamp', rotation: 90, mirrored: true })
    await clickCell(page, 4.5, 4.5)

    // Select, Ctrl+D duplicate, Delete, Escape.
    await page.keyboard.press('v')
    await clickCell(page, 4.5, 4.5)
    expect((await getEditor(page)).selection.ids).toHaveLength(1)
    await page.keyboard.press('Control+d')
    expect(Object.keys((await getDoc(page)).props)).toHaveLength(2)
    await page.keyboard.press('Delete')
    expect(Object.keys((await getDoc(page)).props)).toHaveLength(1)
    await clickCell(page, 4.5, 4.5)
    await page.keyboard.press('Escape')
    expect((await getEditor(page)).selection.ids).toHaveLength(0)

    // Escape cancels an in-progress brush stroke.
    await page.keyboard.press('b')
    const before = await getDoc(page)
    const a = await cellToPage(page, 10.5, 10.5)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(a.x + 120, a.y, { steps: 6 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    expect(await getDoc(page)).toEqual(before)

    // ? opens the help dialog listing every tool shortcut.
    await page.keyboard.press('?')
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(help).toBeVisible()
    for (const label of [
      'Ctrl+Z',
      'Ctrl+Shift+Z / Ctrl+Y',
      'Ctrl+D',
      'Delete',
      'Escape',
      'Ctrl+G',
      '[',
      ']',
      '1',
      '5',
      'B',
      'G',
      'E',
      'R',
      'O',
      'S',
      'W',
      'V',
      'M',
      'H',
    ]) {
      await expect(
        help.locator('kbd', { hasText: new RegExp(`^${label.replace(/[[\]+/]/g, '\\$&')}$`) }),
      ).toHaveCount(1)
    }
    await page.keyboard.press('Escape')
    await expect(help).toBeHidden()
  })

  test('status bar shows the cursor cell, zoom and cell size', async ({ page }) => {
    await freshMap(page, 30, 20)
    const p = await cellToPage(page, 2.5, 6.5)
    await page.mouse.move(p.x, p.y)
    await expect(page.getByTestId('status-cell')).toHaveText('C7')
    await expect(page.getByText('70 px/cell')).toBeVisible()
    await expect(page.getByText('5 ft/cell')).toBeVisible()
    const zoomBefore = await page.getByTestId('status-zoom').textContent()
    await page.mouse.wheel(0, -100)
    await expect(page.getByTestId('status-zoom')).not.toHaveText(zoomBefore!)
    // Zoom is centred on the cursor: the same cell stays under the pointer.
    await page.mouse.move(p.x + 1, p.y)
    await expect(page.getByTestId('status-cell')).toHaveText('C7')
  })

  test('measure tool reports cells and feet', async ({ page }) => {
    await freshMap(page, 30, 20)
    await page.keyboard.press('m')
    await dragCells(page, [1.5, 1.5], [5.5, 5.5])
    const preview = await page.evaluate(() => {
      const w = window as unknown as { __dmtk: { editor: { getState(): { preview: unknown } } } }
      return w.__dmtk.editor.getState().preview
    })
    expect(preview).toEqual({ kind: 'measure', from: { x: 1, y: 1 }, to: { x: 5, y: 5 } })
  })

  test('locked and hidden layers cannot be edited', async ({ page }) => {
    await freshMap(page, 20, 12)
    await page.getByRole('button', { name: 'Lock Terrain layer' }).click()
    await page.keyboard.press('b')
    await clickCell(page, 3.5, 3.5)
    await expect(page.getByRole('status')).toHaveText('Terrain layer is locked')
    expect(Object.keys((await getDoc(page)).tiles)).toHaveLength(0)
    await page.getByRole('button', { name: 'Unlock Terrain layer' }).click()
    await page.keyboard.press('1') // hide terrain
    await clickCell(page, 3.5, 3.5)
    await expect(page.getByRole('status')).toHaveText('Terrain layer is hidden')
    await page.keyboard.press('1')
    await clickCell(page, 3.5, 3.5)
    expect(Object.keys((await getDoc(page)).tiles)).toEqual(['3,3'])
  })

  test('rubber-band select and drag-move terrain; eyedropper; pan', async ({ page }) => {
    await freshMap(page, 20, 12)
    await page.locator('[data-testid="asset-results"] [data-asset="sand"]').click()
    await page.keyboard.press('r')
    await dragCells(page, [2.5, 2.5], [4.5, 3.5]) // 3×2 sand block
    await page.locator('[data-testid="asset-results"] [data-asset="grass"]').click()

    // Alt+click samples sand back as the active terrain tile.
    await page.keyboard.press('b')
    const p = await cellToPage(page, 3.5, 3.5)
    await page.keyboard.down('Alt')
    await page.mouse.click(p.x, p.y)
    await page.keyboard.up('Alt')
    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as { __dmtk: { editor: { getState(): { terrainId: string } } } }
          ).__dmtk.editor.getState().terrainId,
      ),
    ).toBe('sand')

    // Select on the terrain layer with a rubber band, then drag the block 5 cells right.
    await page.keyboard.press('v')
    await page.getByRole('button', { name: 'Make Terrain the active layer' }).click()
    await dragCells(page, [1.5, 1.5], [6.5, 5.5])
    expect((await getEditor(page)).selection.ids).toHaveLength(6)
    await dragCells(page, [3.5, 3.5], [8.5, 3.5])
    expect(Object.keys((await getDoc(page)).tiles).sort()).toEqual([
      '7,2',
      '7,3',
      '8,2',
      '8,3',
      '9,2',
      '9,3',
    ])

    // Space+drag and middle-mouse drag both pan.
    const viewOf = () =>
      page.evaluate(
        () =>
          (
            window as unknown as { __dmtk: { editor: { getState(): { view: { x: number } } } } }
          ).__dmtk.editor.getState().view.x,
      )
    const x0 = await viewOf()
    await page.keyboard.down(' ')
    await page.mouse.move(600, 500)
    await page.mouse.down()
    await page.mouse.move(700, 500, { steps: 5 })
    await page.mouse.up()
    await page.keyboard.up(' ')
    expect(await viewOf()).toBeCloseTo(x0 + 100, 0)
    await page.mouse.move(600, 500)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(550, 500, { steps: 5 })
    await page.mouse.up({ button: 'middle' })
    expect(await viewOf()).toBeCloseTo(x0 + 50, 0)
  })

  test('layer opacity is adjustable and persisted in the document', async ({ page }) => {
    await freshMap(page, 10, 10)
    await page.getByRole('button', { name: 'Make Objects the active layer' }).click()
    await page.getByLabel('Objects opacity').fill('0.4')
    expect((await getDoc(page)).layers.objects.opacity).toBeCloseTo(0.4)
  })

  test('autosave restores the map after reload', async ({ page }) => {
    await freshMap(page, 12, 8)
    await page.locator('[data-testid="asset-results"] [data-asset="water-deep"]').click()
    await page.keyboard.press('g')
    await clickCell(page, 1.5, 1.5)
    await page.waitForTimeout(1200) // autosave debounce
    const before = await getDoc(page)
    await page.reload()
    await page.getByTestId('map-canvas').waitFor()
    await expect.poll(async () => (await getDoc(page)).id).toBe(before.id)
    const after = await getDoc(page)
    expect(after.tiles).toEqual(before.tiles)
  })
})
