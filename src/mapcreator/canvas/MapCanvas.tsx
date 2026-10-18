import type Konva from 'konva'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Shape, Stage } from 'react-konva'
import { useTheme } from '../../app/theme'
import { setCanvasSize } from '../actions'
import { useEditorStore, type View } from '../store/editorStore'
import { useMapStore } from '../store/mapStore'
import { useAssetStore } from '../tilesets/registry'
import { dropAsset, pointerDown, pointerLeave, pointerMove, pointerUp, wheel } from './controller'
import { drawNotes, drawProps, drawWalls } from './draw'
import { drawScreenGrid } from './gridDraw'
import { useCombatStore } from '../../board/initiative/store'
import type { CombatOverlay } from '../../combat/draw'
import { linkedProps, tokenForCombatant } from '../../combat/links'
import { drawOverlay } from './overlayDraw'

/** MIME type used when dragging assets from the library onto the canvas. */
export const ASSET_DRAG_TYPE = 'application/x-dmtk-asset'
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
  const template = useEditorStore((s) => s.template)
  const rings = useEditorStore((s) => s.rings)
  const combat = useCombatStore((s) => s.state)
  const combatOverlay = useMemo<CombatOverlay>(() => {
    const active = combat.combatants.find((c) => c.id === combat.activeId)
    const activeTokenId = tokenForCombatant(active, doc.id)
    // Rings follow the selected token, or the active creature's token.
    const selected =
      selection.layer === 'tokens' && selection.ids.length === 1 ? selection.ids[0] : null
    return {
      activeTokenId: activeTokenId && doc.props[activeTokenId] ? activeTokenId : null,
      template,
      rings,
      ringTokenId: selected ?? activeTokenId,
    }
  }, [combat.combatants, combat.activeId, doc.id, doc.props, selection, template, rings])
  const fn = useMemo<SceneFn>(
    () => (k) =>
      drawOverlay(k._context, doc, preview, selection, view.scale, diagonalRule, combatOverlay),
    [doc, preview, selection, view.scale, diagonalRule, combatOverlay],
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
  const assetsVersion = useAssetStore((s) => s.version)
  const combatants = useCombatStore((s) => s.state.combatants)

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
    const tokens = linkedProps(
      all.filter((p) => p.layer === 'tokens'),
      combatants,
      doc.id,
    )
    return [(k) => drawProps(k._context, objects, cell), (k) => drawProps(k._context, tokens, cell)]
    // assetsVersion: custom tileset art may have changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.props, doc.id, combatants, cell, assetsVersion])
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
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(ASSET_DRAG_TYPE)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(ASSET_DRAG_TYPE)
        if (!id) return
        e.preventDefault()
        dropAsset(id, e, e.currentTarget)
      }}
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
            assetsVersion={assetsVersion}
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
