// Installing user tilesets: decode the PNG, validate tileset.json against it,
// register the assets, and persist both in IndexedDB so they survive reloads.

import { db } from '../../lib/db'
import { registerTileset, unregisterTileset, useAssetStore } from './registry'
import { registerTilesetImage, unregisterTilesetImage } from './spriteCache'
import { parseTileset, type ParseResult, type TilesetFile } from './tilesetFormat'
import type { Frame } from './types'

/** Builds a checker for fully transparent sheet cells (used for auto-sliced sheets). */
function transparencyChecker(image: ImageBitmap): (f: Frame) => boolean {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  const data = ctx.getImageData(0, 0, image.width, image.height).data
  return (f) => {
    for (let y = f.y; y < f.y + f.h; y++) {
      for (let x = f.x; x < f.x + f.w; x++) {
        if (data[(y * image.width + x) * 4 + 3] !== 0) return false
      }
    }
    return true
  }
}

function activate(result: Extract<ParseResult, { ok: true }>, image: ImageBitmap) {
  const ts = result.tileset
  registerTilesetImage(ts.id, image)
  registerTileset(
    {
      id: ts.id,
      name: ts.name,
      assetIds: ts.assets.map((a) => a.id),
      license: ts.license,
      author: ts.author,
    },
    ts.assets,
  )
}

/** Validates and installs a tileset. Nothing is saved if validation fails. */
export async function installTileset(file: TilesetFile, image: Blob): Promise<ParseResult> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(image)
  } catch {
    return { ok: false, errors: ['The image could not be read. Use a PNG (or JPEG/WebP) file.'] }
  }
  const result = parseTileset(file, {
    imageWidth: bitmap.width,
    imageHeight: bitmap.height,
    isFrameEmpty: file.tiles === undefined ? transparencyChecker(bitmap) : undefined,
  })
  if (!result.ok) return result
  activate(result, bitmap)
  await db.tilesets.put({
    id: result.tileset.id,
    name: result.tileset.name,
    file,
    image,
    installedAt: new Date().toISOString(),
  })
  return result
}

export async function removeTileset(id: string): Promise<void> {
  unregisterTileset(id)
  unregisterTilesetImage(id)
  await db.tilesets.delete(id)
}

let loaded: Promise<void> | null = null

/** Loads previously installed tilesets once per session. */
export function loadInstalledTilesets(): Promise<void> {
  loaded ??= (async () => {
    try {
      for (const saved of await db.tilesets.toArray()) {
        if (useAssetStore.getState().tilesets.some((t) => t.id === saved.id)) continue
        const bitmap = await createImageBitmap(saved.image)
        const result = parseTileset(saved.file, {
          id: saved.id,
          imageWidth: bitmap.width,
          imageHeight: bitmap.height,
          isFrameEmpty: saved.file.tiles === undefined ? transparencyChecker(bitmap) : undefined,
        })
        if (result.ok) activate(result, bitmap)
        else console.warn(`Tileset "${saved.name}" no longer validates`, result.errors)
      }
    } catch (err) {
      console.warn('Could not load installed tilesets', err)
    }
  })()
  return loaded
}
