import { FlipHorizontal2, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, Panel } from '../../app/ui'
import { useEditorStore, type WallMode } from '../store/editorStore'
import { getAsset } from '../tilesets/registry'
import { DIAGONAL_RULE_LABELS, type DiagonalRule } from '../tools/measure'
import { TOOLS } from './toolList'

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-600"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded px-2 py-0.5 text-xs ${
            value === o.value
              ? 'bg-amber-500 text-zinc-950'
              : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const Row = ({ children }: { children: ReactNode }) => (
  <div className="mb-2 flex flex-col gap-1 text-xs">{children}</div>
)

export function ToolOptions() {
  const s = useEditorStore()
  const name = TOOLS.find((t) => t.id === s.tool)?.name ?? s.tool
  let body: ReactNode = null

  switch (s.tool) {
    case 'brush':
    case 'eraser':
      body = (
        <Row>
          <label className="flex items-center gap-2">
            Size
            <input
              type="range"
              min={1}
              max={8}
              value={s.brushSize}
              aria-label="Brush size"
              onChange={(e) => s.set({ brushSize: e.target.valueAsNumber })}
              className="flex-1 accent-amber-500"
            />
            <span className="w-8 text-right font-mono">{s.brushSize}</span>
          </label>
          <p className="text-zinc-500 dark:text-zinc-400">
            {s.tool === 'brush'
              ? `Painting ${getAsset(s.terrainId)?.name}. Shift: straight line. Alt+click: eyedropper.`
              : 'Erases from the active layer.'}
          </p>
        </Row>
      )
      break
    case 'fill':
      body = (
        <Row>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.fillRespectsWalls}
              onChange={(e) => s.set({ fillRespectsWalls: e.target.checked })}
            />
            Stop at walls
          </label>
          <p className="text-zinc-500 dark:text-zinc-400">
            Fills contiguous cells of the same tile with {getAsset(s.terrainId)?.name}.
          </p>
        </Row>
      )
      break
    case 'rect':
    case 'ellipse':
      body = (
        <Row>
          <Segmented
            label="Shape mode"
            value={s.shapeMode}
            options={[
              { value: 'fill', label: 'Filled' },
              { value: 'outline', label: 'Outline' },
            ]}
            onChange={(shapeMode) => s.set({ shapeMode })}
          />
        </Row>
      )
      break
    case 'stamp':
      body = (
        <Row>
          <p>
            {getAsset(s.stampId)?.name} · {s.rotation}°{s.mirrored ? ' · mirrored' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => s.set({ rotation: ((s.rotation + 90) % 360) as typeof s.rotation })}
              aria-label="Rotate stamp (R)"
            >
              <RotateCw size={14} aria-hidden /> Rotate (R)
            </Button>
            <Button
              onClick={() => s.set({ mirrored: !s.mirrored })}
              aria-label="Mirror stamp (F)"
              aria-pressed={s.mirrored}
            >
              <FlipHorizontal2 size={14} aria-hidden /> Mirror (F)
            </Button>
          </div>
        </Row>
      )
      break
    case 'wall':
      body = (
        <Row>
          <Segmented<WallMode>
            label="Wall type"
            value={s.wallMode}
            options={[
              { value: 'wall', label: 'Wall' },
              { value: 'door', label: 'Door' },
              { value: 'secret', label: 'Secret door' },
            ]}
            onChange={(wallMode) => s.set({ wallMode })}
          />
          <p className="text-zinc-500 dark:text-zinc-400">
            Drag along grid lines to draw. Click an edge to set a single segment (e.g. turn a wall
            into a door). Right-drag removes.
          </p>
        </Row>
      )
      break
    case 'measure':
      body = (
        <Row>
          <label className="flex flex-col gap-1">
            Diagonals
            <select
              className="rounded border border-zinc-300 bg-white px-1 py-0.5 dark:border-zinc-600 dark:bg-zinc-800"
              value={s.diagonalRule}
              onChange={(e) => s.set({ diagonalRule: e.target.value as DiagonalRule })}
            >
              {Object.entries(DIAGONAL_RULE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </Row>
      )
      break
    case 'select':
      body = (
        <Row>
          <p className="text-zinc-500 dark:text-zinc-400">
            Selects on the active layer. Drag to move, Shift+click to add, Ctrl+D duplicate, Delete
            removes, R/F rotate/mirror props.
          </p>
          <p>{s.selection.ids.length} selected</p>
        </Row>
      )
      break
    case 'label':
      body = (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Click a cell to add a text label or numbered room marker. Click an existing note to edit
          it.
        </p>
      )
      break
    case 'pan':
      body = (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Drag to pan. Wheel zooms at the cursor.
        </p>
      )
      break
  }

  return <Panel title={`Tool · ${name}`}>{body}</Panel>
}
