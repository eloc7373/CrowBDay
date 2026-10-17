import type Konva from 'konva'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Shape, Stage } from 'react-konva'
import { useTheme } from '../../app/theme'
import { setCanvasSize } from '../actions'
import { useEditorStore, type View } from '../store/editorStore'
import { useMapStore } from '../store/mapStore'
import { pointerDown, pointerLeave, pointerMove, pointerUp, wheel } from './controller'
import { drawNotes, drawProps, drawWalls } from './draw'
import { drawScreenGrid } from './gridDraw'
import { drawOverlay } from './overlayDraw'
import { TerrainGroup } from './TerrainGroup'

type SceneFn = (ctx: Konva.Context) => void

const CURSORS: Record<string, string> = {
  pan: 'grab',
  select: 'default',
  measure: 'crosshair',
  label: 'text',
}

const worldProps = (view: View) => ({
  x: view.x,
  y: view.y,
  scaleX: view.scale,
  scaleY: view.scale,
  listening: false,
})

/** Tool previews and selection; re-renders on hover without touching other layers. */
function OverlayLayer() {
  const doc = useMapStore((s) => s.doc)
  const view = useEditorStore((s) => s.view)
  const preview = useEditorStore((s) => s.preview)
  const selection = useEditorStore((s) => s.selection)
  const diagonalRule = useEditorStore((s) => s.diagonalRule)
  const fn = useMemo<SceneFn>(
    () => (k) => drawOverlay(k._context, doc, preview, selection, view.scale, diagonalRule),
    [doc, preview, selection, view.scale, diagonalRule],
  )
  return (
    <Layer {...worldProps(view)}>
      <Shape sceneFunc={fn} />
    </Layer>
  )
}

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const { theme } = useTheme()

  const doc = useMapStore((s) => s.doc)
  const view = useEditorStore((s) => s.view)
  const tool = useEditorStore((s) => s.tool)
  const spaceHeld = useEditorStore((s) => s.spaceHeld)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.max(1, Math.floor(entry.contentRect.width))
      const h = Math.max(1, Math.floor(entry.contentRect.height))
      setSize({ w, h })
      setCanvasSize(w, h)
    })
    ro.observe(el)
    // Wheel must be non-passive so we can preventDefault page zoom/scroll.
    const onWheel = (e: WheelEvent) => wheel(e, el)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const cell = doc.grid.cellSize
  const L = doc.layers
  const dpr = window.devicePixelRatio || 1
  const world = worldProps(view)

  const wallsFn = useMemo<SceneFn>(
    () => (k) => drawWalls(k._context, doc.walls, cell, { revealSecrets: true }),
    [doc.walls, cell],
  )
  const [objectsFn, tokensFn] = useMemo<SceneFn[]>(() => {
    const all = Object.values(doc.props)
    const objects = all.filter((p) => p.layer === 'objects')
    const tokens = all.filter((p) => p.layer === 'tokens')
    return [(k) => drawProps(k._context, objects, cell), (k) => drawProps(k._context, tokens, cell)]
  }, [doc.props, cell])
  const notesFn = useMemo<SceneFn>(() => {
    const notes = Object.values(doc.notes)
    return (k) => drawNotes(k._context, notes, cell)
  }, [doc.notes, cell])
  const gridFn = useMemo<SceneFn>(
    () => (k) =>
      drawScreenGrid(
        k._context,
        view,
        doc.width,
        doc.height,
        doc.grid,
        size.w,
        size.h,
        dpr,
        theme === 'dark' ? '#f59e0b' : '#b45309',
      ),
    [view, doc.width, doc.height, doc.grid, size, dpr, theme],
  )

  const cursor = spaceHeld ? 'grab' : (CURSORS[tool] ?? 'crosshair')

  return (
    <div
      ref={containerRef}
      data-testid="map-canvas"
      className="absolute inset-0 touch-none overflow-hidden bg-zinc-300 select-none dark:bg-zinc-950"
      style={{ cursor }}
      role="application"
      aria-label="Map editor canvas"
      onPointerDown={(e) => pointerDown(e, e.currentTarget)}
      onPointerMove={(e) => pointerMove(e, e.currentTarget)}
      onPointerUp={(e) => pointerUp(e, e.currentTarget)}
      onPointerCancel={(e) => pointerUp(e, e.currentTarget)}
      onPointerLeave={pointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Four canvases: map content, screen-space grid, tokens + notes, tool overlay.
          The fixed layer order is Terrain → Walls → Objects → (grid) → Tokens → Notes. */}
      <Stage width={size.w} height={size.h} listening={false}>
        <Layer {...world}>
          <TerrainGroup
            tiles={doc.tiles}
            width={doc.width}
            height={doc.height}
            cellSize={cell}
            visible={L.terrain.visible}
            opacity={L.terrain.opacity}
            background={theme === 'dark' ? '#3a3631' : '#f4efe4'}
          />
          <Shape sceneFunc={wallsFn} visible={L.walls.visible} opacity={L.walls.opacity} />
          <Shape sceneFunc={objectsFn} visible={L.objects.visible} opacity={L.objects.opacity} />
        </Layer>
        <Layer listening={false}>
          <Shape sceneFunc={gridFn} />
        </Layer>
        <Layer {...world}>
          <Shape sceneFunc={tokensFn} visible={L.tokens.visible} opacity={L.tokens.opacity} />
          <Shape sceneFunc={notesFn} visible={L.notes.visible} opacity={L.notes.opacity} />
        </Layer>
        <OverlayLayer />
      </Stage>
    </div>
  )
}
