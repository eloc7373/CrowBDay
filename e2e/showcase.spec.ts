import { expect, test } from '@playwright/test'

test('showcase plays as a guided feature tour with playback controls', async ({ page }) => {
  await page.goto('/#/showcase')
  await expect(page.getByRole('heading', { name: 'Build a world worth getting lost in.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Download video/ })).toHaveAttribute('href', '/dm-toolkit-showcase.mp4')
  const mapTile = page.getByRole('button', { name: 'Edit map tile 1', exact: true })
  const originalTileStyle = await mapTile.getAttribute('class')
  await mapTile.click({ force: true })
  await expect(mapTile).not.toHaveAttribute('class', originalTileStyle ?? '')
  await page.getByRole('button', { name: 'Pause showcase' }).click()
  await page.getByRole('button', { name: 'Next scene' }).click()
  await expect(page.getByRole('heading', { name: 'Start with a spark. Make it yours.' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Showcase timeline' })).toBeVisible()
})
