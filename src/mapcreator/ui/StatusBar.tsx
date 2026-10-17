import { Minus, Plus } from 'lucide-react'
import { cellLabel } from '../../lib/geometry'
import { zoomBy } from '../actions'
import { LAYER_NAMES } from '../layers/model'
import { useEditorStore } from '../store/editorStore'
import { useMapStore } from '../store/mapStore'

export function StatusBar() {
  const cursor = useEditorStore((s) => s.cursor)
  const scale = useEditorStore((s) => s.view.scale)
  const status = useEditorStore((s) => s.status)
  const layer = useEditorStore((s) => s.activeLayer)
  const { cellSize, feetPerCell } = useMapStore((s) => s.doc.grid)
  const width = useMapStore((s) => s.doc.width)
  const height = useMapStore((s) => s.doc.height)

  return (
    <footer
      className="flex items-center gap-4 border-t border-zinc-200 bg-zinc-50 px-3 py-1 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      aria-label="Status bar"
    >
      <span data-testid="status-cell" className="w-16" aria-label="Cursor cell">
        {cursor ? cellLabel(cursor.x, cursor.y) : '—'}
      </span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomBy(1 / 1.25)}
          className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <Minus size={12} aria-hidden />
        </button>
        <span data-testid="status-zoom" className="w-12 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomBy(1.25)}
          className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <Plus size={12} aria-hidden />
        </button>
      </span>
      <span>{cellSize} px/cell</span>
      <span>{feetPerCell} ft/cell</span>
      <span>
        {width}×{height} cells
      </span>
      <span>Layer: {LAYER_NAMES[layer]}</span>
      <span role="status" aria-live="polite" className="ml-auto text-amber-700 dark:text-amber-400">
        {status}
      </span>
    </footer>
  )
}
