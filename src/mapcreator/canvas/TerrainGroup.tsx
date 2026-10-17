// Terrain is rendered into 16×16-cell offscreen chunk canvases (a manual form of
// Konva layer caching). Only chunks whose tiles changed are redrawn; panning and
// zooming just re-blit the cached bitmaps.

import type Konva from 'konva'
import { useLayoutEffect, useRef, useState } from 'react'
import { Group, Image as KonvaImage, Rect } from 'react-konva'
import { CHUNK_CELLS, chunkCellPx, drawTerrainChunk } from './draw'

const chunkOf = (key: string) => {
  const i = key.indexOf(',')
  const x = Math.floor(Number(key.slice(0, i)) / CHUNK_CELLS)
  const y = Math.floor(Number(key.slice(i + 1)) / CHUNK_CELLS)
  return `${x},${y}`
}

/** A changed cell dirties its own chunk and, for autotiles, its neighbours' chunks. */
function markDirty(dirty: Set<string>, key: string) {
  const i = key.indexOf(',')
  const x = Number(key.slice(0, i))
  const y = Number(key.slice(i + 1))
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    dirty.add(`${Math.floor((x + dx) / CHUNK_CELLS)},${Math.floor((y + dy) / CHUNK_CELLS)}`)
  }
}

interface Props {
  tiles: Record<string, string>
  width: number
  height: number
  cellSize: number
  visible: boolean
  opacity: number
  background: string
  /** Asset registry version; a change means tile art may differ, so redraw everything. */
  assetsVersion: number
}

type ChunkEntry = { key: string; x: number; y: number; canvas: HTMLCanvasElement }

export function TerrainGroup({
  tiles,
  width,
  height,
  cellSize,
  visible,
  opacity,
  background,
  assetsVersion,
}: Props) {
  const groupRef = useRef<Konva.Group>(null)
  const cache = useRef({
    tiles: {} as Record<string, string>,
    cellPx: 0,
    version: -1,
    chunks: new Map<string, ChunkEntry>(),
  })
  const [chunks, setChunks] = useState<ChunkEntry[]>([])

  useLayoutEffect(() => {
    const c = cache.current
    const cellPx = chunkCellPx(width, height, cellSize)
    const dirty = new Set<string>()
    const reset = cellPx !== c.cellPx || assetsVersion !== c.version
    if (reset) {
      c.chunks.clear()
      c.cellPx = cellPx
      c.version = assetsVersion
      for (const k in tiles) dirty.add(chunkOf(k))
    } else {
      const prev = c.tiles
      for (const k in tiles) if (tiles[k] !== prev[k]) markDirty(dirty, k)
      for (const k in prev) if (!(k in tiles)) markDirty(dirty, k)
    }
    c.tiles = tiles
    if (dirty.size === 0 && !reset) return

    const buckets = new Map<string, string[]>()
    for (const d of dirty) buckets.set(d, [])
    for (const k in tiles) buckets.get(chunkOf(k))?.push(k)

    let listChanged = reset
    for (const [ck, keys] of buckets) {
      if (keys.length === 0) {
        if (c.chunks.delete(ck)) listChanged = true
        continue
      }
      let entry = c.chunks.get(ck)
      if (!entry) {
        const [x, y] = ck.split(',').map(Number)
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = CHUNK_CELLS * cellPx
        entry = { key: ck, x, y, canvas }
        c.chunks.set(ck, entry)
        listChanged = true
      }
      drawTerrainChunk(entry.canvas.getContext('2d')!, tiles, keys, entry.x, entry.y, cellPx)
    }
    if (listChanged) setChunks([...c.chunks.values()])
    // Canvases were redrawn in place, so Konva must be told to repaint.
    groupRef.current?.getLayer()?.batchDraw()
  }, [tiles, width, height, cellSize, assetsVersion])

  const size = CHUNK_CELLS * cellSize
  return (
    <Group ref={groupRef}>
      <Rect width={width * cellSize} height={height * cellSize} fill={background} />
      {chunks.map((ch) => (
        <KonvaImage
          key={ch.key}
          image={ch.canvas}
          x={ch.x * size}
          y={ch.y * size}
          width={size}
          height={size}
          visible={visible}
          opacity={opacity}
        />
      ))}
    </Group>
  )
}
