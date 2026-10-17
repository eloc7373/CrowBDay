import { Panel } from '../../app/ui'
import { useMapStore } from '../store/mapStore'

export function GridPanel() {
  const grid = useMapStore((s) => s.doc.grid)
  const setGrid = useMapStore((s) => s.setGrid)
  return (
    <Panel title="Grid">
      <div className="flex flex-col gap-2 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={grid.visible}
            onChange={(e) => setGrid({ visible: e.target.checked })}
          />
          Show grid (Ctrl+G)
        </label>
        <label className="flex items-center gap-2">
          Color
          <input
            type="color"
            value={grid.color}
            aria-label="Grid color"
            onChange={(e) => setGrid({ color: e.target.value })}
            className="h-6 w-10 rounded border border-zinc-300 dark:border-zinc-600"
          />
          Opacity
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={grid.opacity}
            aria-label="Grid opacity"
            onChange={(e) => setGrid({ opacity: e.target.valueAsNumber })}
            className="flex-1 accent-amber-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            Cell size (px)
            <input
              type="number"
              min={10}
              max={400}
              value={grid.cellSize}
              onChange={(e) => {
                const v = Math.round(e.target.valueAsNumber)
                if (v >= 10 && v <= 400) setGrid({ cellSize: v })
              }}
              className="rounded border border-zinc-300 bg-white px-1 py-0.5 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1">
            Feet per cell
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={grid.feetPerCell}
              onChange={(e) => {
                const v = e.target.valueAsNumber
                if (v > 0) setGrid({ feetPerCell: v })
              }}
              className="rounded border border-zinc-300 bg-white px-1 py-0.5 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
        </div>
      </div>
    </Panel>
  )
}
