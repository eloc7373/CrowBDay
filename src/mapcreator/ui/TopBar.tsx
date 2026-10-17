import { FilePlus2, Grid3x3, HelpCircle, Maximize, Redo2, Undo2 } from 'lucide-react'
import { Button, inputClass } from '../../app/ui'
import { fitToScreen, redo, toggleGrid, undo } from '../actions'
import { useEditorStore } from '../store/editorStore'
import { useMapStore } from '../store/mapStore'

export function TopBar() {
  const name = useMapStore((s) => s.doc.name)
  const setName = useMapStore((s) => s.setName)
  const canUndo = useMapStore((s) => s.past.length > 0)
  const canRedo = useMapStore((s) => s.future.length > 0)
  const undoLabel = useMapStore((s) => s.past[s.past.length - 1]?.label)
  const redoLabel = useMapStore((s) => s.future[s.future.length - 1]?.label)
  const gridOn = useMapStore((s) => s.doc.grid.visible)
  const set = useEditorStore((s) => s.set)

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
      <input
        aria-label="Map name"
        className={`${inputClass} max-w-56 font-semibold`}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button onClick={() => set({ newMapOpen: true })} aria-label="New map">
        <FilePlus2 size={16} aria-hidden /> New
      </Button>
      <div className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />
      <Button
        variant="ghost"
        onClick={undo}
        disabled={!canUndo}
        aria-label={undoLabel ? `Undo ${undoLabel}` : 'Undo'}
        title={`Undo ${undoLabel ?? ''} (Ctrl+Z)`}
      >
        <Undo2 size={16} aria-hidden />
      </Button>
      <Button
        variant="ghost"
        onClick={redo}
        disabled={!canRedo}
        aria-label={redoLabel ? `Redo ${redoLabel}` : 'Redo'}
        title={`Redo ${redoLabel ?? ''} (Ctrl+Shift+Z)`}
      >
        <Redo2 size={16} aria-hidden />
      </Button>
      <div className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />
      <Button
        variant="ghost"
        onClick={toggleGrid}
        aria-pressed={gridOn}
        aria-label="Toggle grid"
        title="Toggle grid (Ctrl+G)"
      >
        <Grid3x3 size={16} aria-hidden />
      </Button>
      <Button
        variant="ghost"
        onClick={fitToScreen}
        aria-label="Fit map to screen"
        title="Fit to screen (0)"
      >
        <Maximize size={16} aria-hidden />
      </Button>
      <div className="flex-1" />
      <Button
        variant="ghost"
        onClick={() => set({ helpOpen: true })}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <HelpCircle size={16} aria-hidden /> Shortcuts
      </Button>
    </div>
  )
}
