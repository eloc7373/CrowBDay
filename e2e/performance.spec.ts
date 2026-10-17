import { expect, test, type Page } from '@playwright/test'
import { freshMap } from './helpers'

/** Fills the map with tiles/props/walls through the store, then animates pan+zoom. */
async function stressAndMeasure(page: Page, width: number, height: number, frames: number) {
  await freshMap(page, width, height)
  return page.evaluate(
    async ({ width, height, frames }) => {
      type Store = {
        getState(): Record<string, (...a: unknown[]) => unknown> & { doc: { tiles: object } }
      }
      const w = window as unknown as { __dmtk: { map: Store; editor: Store } }
      const map = w.__dmtk.map.getState()
      const tiles = ['stone-floor', 'grass', 'dirt', 'wood-floor', 'water-shallow', 'sand']
      const changes: unknown[] = []
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          changes.push({
            coll: 'tiles',
            key: `${x},${y}`,
            after: tiles[(x * 7 + y * 3) % tiles.length],
          })
      for (let i = 0; i < 150; i++) {
        const id = `perf${i}`
        changes.push({
          coll: 'props',
          key: id,
          after: {
            id,
            layer: 'objects',
            defId: ['barrel', 'crate', 'table', 'chair'][i % 4],
            x: (i * 13) % (width - 2),
            y: (i * 7) % (height - 1),
            rotation: 0,
            mirrored: false,
          },
        })
      }
      for (let x = 0; x < width; x++)
        changes.push({
          coll: 'walls',
          key: `h:${x},${Math.floor(height / 2)}`,
          after: { door: x % 5 === 0, secret: false },
        })
      map.commit('Stress', changes)
      const tileCount = Object.keys(w.__dmtk.map.getState().doc.tiles).length

      await new Promise((r) => setTimeout(r, 300))
      const editor = w.__dmtk.editor.getState()
      const start = (editor as unknown as { view: { x: number; y: number; scale: number } }).view
      const intervals: number[] = []
      let last = performance.now()
      await new Promise<void>((resolve) => {
        let i = 0
        const step = () => {
          const now = performance.now()
          if (i > 0) intervals.push(now - last)
          last = now
          // Pan in a circle while zooming between 0.4× and 1.6× of the start scale.
          const t = i / 30
          w.__dmtk.editor.getState().set({
            view: {
              x: start.x + Math.cos(t) * 300,
              y: start.y + Math.sin(t) * 200,
              scale: start.scale * (1 + 0.6 * Math.sin(t * 0.7)),
            },
          })
          if (++i <= frames) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })
      intervals.sort((a, b) => a - b)
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      return {
        tileCount,
        avgMs: +avg.toFixed(2),
        p95Ms: +intervals[Math.floor(intervals.length * 0.95)].toFixed(2),
        fps: +(1000 / avg).toFixed(1),
      }
    },
    { width, height, frames },
  )
}

test('pan/zoom stays smooth with 2,000 painted tiles (Phase 1 target: 1,000+)', async ({
  page,
}) => {
  const r = await stressAndMeasure(page, 50, 40, 240)
  console.log('2,000 tiles:', JSON.stringify(r))
  expect(r.tileCount).toBe(2000)
  // Target is 60 fps; assert a conservative floor so headless CI noise doesn't flake.
  expect(r.fps).toBeGreaterThan(45)
})

test('pan/zoom on a 100×100 map with 10,000 tiles (Phase 6 target)', async ({ page }) => {
  const r = await stressAndMeasure(page, 100, 100, 240)
  console.log('10,000 tiles:', JSON.stringify(r))
  expect(r.tileCount).toBe(10000)
  expect(r.fps).toBeGreaterThan(30)
})
