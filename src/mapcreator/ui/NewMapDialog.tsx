import { useState, type FormEvent } from 'react'
import { Modal } from '../../app/Modal'
import { Button, Field, inputClass, NumberInput } from '../../app/ui'
import { fitToScreen } from '../actions'
import { MAX_MAP_SIZE, MIN_MAP_SIZE } from '../layers/model'
import { useEditorStore } from '../store/editorStore'
import { useMapStore } from '../store/mapStore'

const PRESETS = [
  { label: 'Battle 30×20', w: 30, h: 20 },
  { label: 'Dungeon 40×40', w: 40, h: 40 },
  { label: 'Town 60×40', w: 60, h: 40 },
]

function NewMapForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('Untitled map')
  const [width, setWidth] = useState(30)
  const [height, setHeight] = useState(20)
  const [cellSize, setCellSize] = useState(70)
  const [feet, setFeet] = useState(5)

  const sizeOk = (n: number) => Number.isInteger(n) && n >= MIN_MAP_SIZE && n <= MAX_MAP_SIZE
  const error =
    !sizeOk(width) || !sizeOk(height)
      ? `Width and height must be whole numbers from ${MIN_MAP_SIZE} to ${MAX_MAP_SIZE}.`
      : !(Number.isInteger(cellSize) && cellSize >= 10 && cellSize <= 400)
        ? 'Cell size must be a whole number of pixels from 10 to 400.'
        : !(feet > 0)
          ? 'Feet per cell must be positive.'
          : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (error) return
    useMapStore
      .getState()
      .newMap({ name: name.trim() || 'Untitled map', width, height, cellSize, feetPerCell: feet })
    useEditorStore.getState().set({ selection: { layer: 'objects', ids: [] }, preview: null })
    onDone()
    requestAnimationFrame(fitToScreen)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="New map">
      <Field label="Name">
        <input
          data-autofocus
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.label} onClick={() => (setWidth(p.w), setHeight(p.h))}>
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Width (cells)">
          <NumberInput
            aria-label="Width in cells"
            value={width}
            onValue={setWidth}
            min={MIN_MAP_SIZE}
            max={MAX_MAP_SIZE}
          />
        </Field>
        <Field label="Height (cells)">
          <NumberInput
            aria-label="Height in cells"
            value={height}
            onValue={setHeight}
            min={MIN_MAP_SIZE}
            max={MAX_MAP_SIZE}
          />
        </Field>
        <Field label="Cell size (px)">
          <NumberInput value={cellSize} onValue={setCellSize} min={10} max={400} />
        </Field>
        <Field label="Feet per cell">
          <NumberInput value={feet} onValue={setFeet} min={1} step={0.5} />
        </Field>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        70 px per 5 ft cell is the common VTT default. The map will be {width * cellSize || 0}×
        {height * cellSize || 0} px at 1×.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!!error}>
          Create map
        </Button>
      </div>
    </form>
  )
}

export function NewMapDialog() {
  const open = useEditorStore((s) => s.newMapOpen)
  const set = useEditorStore((s) => s.set)
  const close = () => set({ newMapOpen: false })
  return (
    <Modal open={open} title="New map" onClose={close}>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
        This replaces the current map. Undo history is cleared.
      </p>
      <NewMapForm onDone={close} />
    </Modal>
  )
}
