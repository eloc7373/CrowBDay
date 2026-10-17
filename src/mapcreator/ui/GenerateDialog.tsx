// Procedural generation dialog: pick a generator, tweak parameters, see a live
// preview, and merge the result into the map as one undoable action.

import { Copy, Dices } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Modal } from '../../app/Modal'
import { Button, Field, inputClass, NumberInput } from '../../app/ui'
import { copyText } from '../../lib/clipboard'
import { parseCellKey } from '../../lib/geometry'
import { randomSeed } from '../../lib/rng'
import { fitToScreen } from '../actions'
import {
  GENERATOR_DEFAULTS,
  GENERATOR_LABELS,
  generationChanges,
  runGenerator,
  type GeneratorKind,
  type GeneratorParams,
  type GenResult,
  type MergeMode,
} from '../generation'
import { MAX_MAP_SIZE, parseEdgeKey } from '../layers/model'
import { useEditorStore } from '../store/editorStore'
import { useMapStore } from '../store/mapStore'
import { getAsset } from '../tilesets/registry'
import { propRect } from '../tools/paint'

function drawPreview(canvas: HTMLCanvasElement, res: GenResult) {
  const size = Math.max(2, Math.floor(Math.min(440 / res.width, 300 / res.height)))
  canvas.width = res.width * size
  canvas.height = res.height * size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (const [k, t] of Object.entries(res.tiles)) {
    const c = parseCellKey(k)
    const art = getAsset(t)?.art
    ctx.fillStyle = art?.type === 'procedural' ? art.colors[0] : '#888'
    ctx.fillRect(c.x * size, c.y * size, size, size)
  }
  for (const p of res.props) {
    const r = propRect(p)
    const art = getAsset(p.defId)?.art
    ctx.fillStyle = art?.type === 'procedural' ? art.colors[0] : '#555'
    ctx.fillRect(r.x * size + 1, r.y * size + 1, r.w * size - 2, r.h * size - 2)
  }
  ctx.lineWidth = Math.max(1, size / 4)
  for (const [k, w] of Object.entries(res.walls)) {
    const e = parseEdgeKey(k)
    ctx.strokeStyle = w.secret ? '#a855f7' : w.door ? '#f59e0b' : '#000'
    ctx.beginPath()
    ctx.moveTo(e.x * size, e.y * size)
    if (e.o === 'h') ctx.lineTo((e.x + 1) * size, e.y * size)
    else ctx.lineTo(e.x * size, (e.y + 1) * size)
    ctx.stroke()
  }
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.max(9, size * 1.6)}px sans-serif`
  for (const n of res.notes)
    if (n.number !== undefined) ctx.fillText(String(n.number), n.x * size + 1, (n.y + 1) * size)
}

function Num({
  label,
  value,
  onValue,
  min,
  max,
  step,
}: {
  label: string
  value: number
  onValue: (v: number) => void
  min: number
  max: number
  step?: number
}) {
  return (
    <Field label={label}>
      <NumberInput
        aria-label={label}
        value={value}
        onValue={onValue}
        min={min}
        max={max}
        step={step}
      />
    </Field>
  )
}

const Check = ({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) => (
  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
)

function GenerateForm({ onDone }: { onDone: () => void }) {
  const doc = useMapStore.getState().doc
  const [kind, setKind] = useState<GeneratorKind>('dungeon')
  const [params, setParams] = useState<GeneratorParams>(() => {
    // Start cave/dungeon at the current map size when it fits.
    const w = Math.min(MAX_MAP_SIZE, Math.max(10, doc.width))
    const h = Math.min(MAX_MAP_SIZE, Math.max(10, doc.height))
    return {
      ...GENERATOR_DEFAULTS,
      cave: { ...GENERATOR_DEFAULTS.cave, width: w, height: h },
      dungeon: { ...GENERATOR_DEFAULTS.dungeon, width: w, height: h },
    }
  })
  const [seed, setSeed] = useState(() => randomSeed())
  const [mode, setMode] = useState<MergeMode>('replace')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const set = <K extends GeneratorKind>(k: K, patch: Partial<GeneratorParams[K]>) =>
    setParams((p) => ({ ...p, [k]: { ...p[k], ...patch } }))

  const result = useMemo(() => {
    try {
      return { res: runGenerator(kind, params[kind], seed.trim() || 'seed'), error: null }
    } catch (e) {
      return { res: null, error: (e as Error).message }
    }
  }, [kind, params, seed])

  useEffect(() => {
    if (result.res && canvasRef.current) drawPreview(canvasRef.current, result.res)
  }, [result])

  const generate = () => {
    if (!result.res) return
    const s = useMapStore.getState()
    s.commit(
      `Generate ${GENERATOR_LABELS[kind].toLowerCase()}`,
      generationChanges(s.doc, result.res, mode),
    )
    useEditorStore.getState().set({ selection: { layer: 'objects', ids: [] }, preview: null })
    useEditorStore
      .getState()
      .flash(
        `Generated ${GENERATOR_LABELS[kind].toLowerCase()} · seed ${result.res.seed} · Ctrl+Z to undo`,
      )
    onDone()
    if (mode === 'replace') requestAnimationFrame(fitToScreen)
  }

  const c = params.cave
  const d = params.dungeon
  const t = params.tavern
  const v = params.village
  let form: ReactNode
  switch (kind) {
    case 'cave':
      form = (
        <>
          <Num
            label="Width"
            value={c.width}
            onValue={(width) => set('cave', { width })}
            min={8}
            max={MAX_MAP_SIZE}
          />
          <Num
            label="Height"
            value={c.height}
            onValue={(height) => set('cave', { height })}
            min={8}
            max={MAX_MAP_SIZE}
          />
          <Num
            label="Fill %"
            value={c.fillPercent}
            onValue={(fillPercent) => set('cave', { fillPercent })}
            min={30}
            max={70}
          />
          <Num
            label="Smoothing passes"
            value={c.iterations}
            onValue={(iterations) => set('cave', { iterations })}
            min={0}
            max={10}
          />
          <Num
            label="Min cave size (cells)"
            value={c.minCaveSize}
            onValue={(minCaveSize) => set('cave', { minCaveSize })}
            min={1}
            max={500}
          />
          <Check
            label="Connect all caves with tunnels"
            checked={c.connect}
            onChange={(connect) => set('cave', { connect })}
          />
        </>
      )
      break
    case 'dungeon':
      form = (
        <>
          <Num
            label="Width"
            value={d.width}
            onValue={(width) => set('dungeon', { width })}
            min={10}
            max={MAX_MAP_SIZE}
          />
          <Num
            label="Height"
            value={d.height}
            onValue={(height) => set('dungeon', { height })}
            min={10}
            max={MAX_MAP_SIZE}
          />
          <Num
            label="Min room size"
            value={d.minRoomSize}
            onValue={(minRoomSize) => set('dungeon', { minRoomSize })}
            min={3}
            max={20}
          />
          <Num
            label="Max room size"
            value={d.maxRoomSize}
            onValue={(maxRoomSize) => set('dungeon', { maxRoomSize })}
            min={3}
            max={30}
          />
          <Field label="Corridor width">
            <select
              className={inputClass}
              value={d.corridorWidth}
              onChange={(e) => set('dungeon', { corridorWidth: Number(e.target.value) as 1 | 2 })}
            >
              <option value={1}>1 cell (5 ft)</option>
              <option value={2}>2 cells (10 ft)</option>
            </select>
          </Field>
          <Num
            label="Door probability %"
            value={Math.round(d.doorChance * 100)}
            onValue={(n) => set('dungeon', { doorChance: n / 100 })}
            min={0}
            max={100}
          />
          <Num
            label="Secret doors"
            value={d.secretDoors}
            onValue={(secretDoors) => set('dungeon', { secretDoors })}
            min={0}
            max={3}
          />
          <Check
            label="Add stairs (up at the entrance, down in the farthest room)"
            checked={d.stairs}
            onChange={(stairs) => set('dungeon', { stairs })}
          />
        </>
      )
      break
    case 'tavern':
      form = (
        <>
          <Num
            label="Rooms"
            value={t.roomCount}
            onValue={(roomCount) => set('tavern', { roomCount })}
            min={1}
            max={6}
          />
          <Num
            label="Footprint width"
            value={t.footprintWidth}
            onValue={(footprintWidth) => set('tavern', { footprintWidth })}
            min={8}
            max={60}
          />
          <Num
            label="Footprint height"
            value={t.footprintHeight}
            onValue={(footprintHeight) => set('tavern', { footprintHeight })}
            min={8}
            max={50}
          />
          <Check label="Bar counter" checked={t.bar} onChange={(bar) => set('tavern', { bar })} />
          <Check
            label="Hearth"
            checked={t.hearth}
            onChange={(hearth) => set('tavern', { hearth })}
          />
          <Check
            label="Tables and chairs"
            checked={t.tables}
            onChange={(tables) => set('tavern', { tables })}
          />
        </>
      )
      break
    case 'village':
      form = (
        <>
          <Num
            label="Blocks"
            value={v.blocks}
            onValue={(blocks) => set('village', { blocks })}
            min={1}
            max={16}
          />
          <Num
            label="Main road width"
            value={v.roadWidth}
            onValue={(roadWidth) => set('village', { roadWidth })}
            min={1}
            max={3}
          />
          <Num
            label="Building density %"
            value={Math.round(v.density * 100)}
            onValue={(n) => set('village', { density: n / 100 })}
            min={0}
            max={100}
          />
        </>
      )
      break
  }

  const res = result.res
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Generator" className="flex flex-wrap gap-1">
        {(Object.keys(GENERATOR_LABELS) as GeneratorKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-md px-3 py-1 text-sm ${
              kind === k
                ? 'bg-amber-500 text-zinc-950'
                : 'border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800'
            }`}
          >
            {GENERATOR_LABELS[k]}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 content-start gap-3">
          {form}
          <div className="col-span-2 flex items-end gap-1">
            <Field label="Seed">
              <input
                aria-label="Seed"
                className={`${inputClass} font-mono`}
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
            </Field>
            <Button
              aria-label="New random seed"
              title="New random seed"
              onClick={() => setSeed(randomSeed())}
            >
              <Dices size={16} aria-hidden />
            </Button>
            <Button
              aria-label="Copy seed"
              title="Copy seed"
              onClick={() =>
                void copyText(seed).then(
                  (ok) => ok && useEditorStore.getState().flash('Seed copied'),
                )
              }
            >
              <Copy size={16} aria-hidden />
            </Button>
          </div>
          <fieldset className="col-span-2 flex flex-col gap-1 text-sm">
            <legend className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Apply to map
            </legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="merge"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
              />
              Replace the whole map{res ? ` (resizes to ${res.width}×${res.height})` : ''}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="merge"
                checked={mode === 'overlay'}
                onChange={() => setMode('overlay')}
              />
              Overlay on the current map (from the top-left, clipped to {doc.width}×{doc.height})
            </label>
          </fieldset>
        </div>
        <div className="flex flex-col items-center gap-1">
          <canvas
            ref={canvasRef}
            aria-label="Generated map preview"
            className="rounded border border-zinc-300 [image-rendering:pixelated] dark:border-zinc-700"
          />
          {res && (
            <p className="text-xs text-zinc-500" data-testid="generate-summary">
              {res.width}×{res.height} · {res.rooms.length} rooms ·{' '}
              {Object.values(res.walls).filter((w) => w.door).length} door edges
            </p>
          )}
          {result.error && (
            <p role="alert" className="text-xs text-red-600">
              {result.error}
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="primary" onClick={generate} disabled={!res}>
          Generate
        </Button>
      </div>
    </div>
  )
}

export function GenerateDialog() {
  const open = useEditorStore((s) => s.generateOpen)
  const set = useEditorStore((s) => s.set)
  const close = () => set({ generateOpen: false })
  return (
    <Modal open={open} title="Generate map" onClose={close} wide>
      <GenerateForm onDone={close} />
    </Modal>
  )
}
