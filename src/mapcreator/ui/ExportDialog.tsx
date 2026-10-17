// Export: grid-aligned PNG for VTTs, print PDF, versioned map file, and an
// experimental Foundry scene with walls.

import { Download } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Modal } from '../../app/Modal'
import { Button, Field, inputClass, NumberInput } from '../../app/ui'
import { foundryFilename, toFoundryScene } from '../export/foundry'
import { fitsCanvas, PAPERS, pngLayout, type Paper } from '../export/layout'
import { packageFilename, toPackage } from '../export/mapPackage'
import { exportPdf } from '../export/pdf'
import {
  canvasToBlob,
  downloadBlob,
  fogMask,
  renderMap,
  type RenderOptions,
} from '../export/render'
import { useEditorStore } from '../store/editorStore'
import { useMapStore } from '../store/mapStore'

type Tab = 'png' | 'pdf' | 'json' | 'foundry'

const TABS: { id: Tab; label: string }[] = [
  { id: 'png', label: 'Image (PNG)' },
  { id: 'pdf', label: 'Print (PDF)' },
  { id: 'json', label: 'Map file (JSON)' },
  { id: 'foundry', label: 'Foundry scene (experimental)' },
]

const Check = ({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) => (
  <label className="flex items-start gap-2 text-sm">
    <input
      type="checkbox"
      className="mt-1"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span>
      {label}
      {hint && <span className="block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </span>
  </label>
)

interface Content {
  grid: boolean
  walls: boolean
  objects: boolean
  tokens: boolean
  notes: boolean
  secrets: boolean
}

function ContentOptions({ value, onChange }: { value: Content; onChange: (c: Content) => void }) {
  const set = (patch: Partial<Content>) => onChange({ ...value, ...patch })
  return (
    <div className="grid grid-cols-2 gap-2">
      <Check label="Grid" checked={value.grid} onChange={(grid) => set({ grid })} />
      <Check label="Walls & doors" checked={value.walls} onChange={(walls) => set({ walls })} />
      <Check
        label="Objects / props"
        checked={value.objects}
        onChange={(objects) => set({ objects })}
      />
      <Check
        label="Tokens"
        hint="Hidden tokens are never exported"
        checked={value.tokens}
        onChange={(tokens) => set({ tokens })}
      />
      <Check
        label="Notes & room numbers"
        hint="Usually DM-only"
        checked={value.notes}
        onChange={(notes) => set({ notes })}
      />
      <Check
        label="Show secret doors"
        hint="Off = drawn as plain wall (player copy)"
        checked={value.secrets}
        onChange={(secrets) => set({ secrets })}
      />
    </div>
  )
}

function ExportForm({ onDone }: { onDone: () => void }) {
  const doc = useMapStore((s) => s.doc)
  const flash = useEditorStore((s) => s.flash)
  const [tab, setTab] = useState<Tab>('png')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Image options
  const [cellPx, setCellPx] = useState(doc.grid.cellSize)
  const [scale, setScale] = useState(1)
  const [content, setContent] = useState<Content>({
    grid: true,
    walls: true,
    objects: true,
    tokens: false,
    notes: false,
    secrets: false,
  })
  const [transparent, setTransparent] = useState(false)
  const [background, setBackground] = useState('#3a3631')
  const [fog, setFog] = useState(false)
  // Print options
  const [paperKey, setPaperKey] = useState<'letter' | 'a4' | 'custom'>('letter')
  const [custom, setCustom] = useState<Paper>({ w: 300, h: 450 })
  const [margin, setMargin] = useState(10)
  const [printContent, setPrintContent] = useState<Content>({
    grid: true,
    walls: true,
    objects: true,
    tokens: false,
    notes: true,
    secrets: true,
  })

  const layout = pngLayout(doc.name, doc.width, doc.height, { cellPx: cellPx || 1, scale })
  const tooBig = !fitsCanvas(layout.width, layout.height)
  const cellOk = Number.isInteger(cellPx) && cellPx >= 10 && cellPx <= 400

  const renderOpts = (c: Content, bg: string | null): Omit<RenderOptions, 'cellPx'> => ({
    includeGrid: c.grid,
    includeWalls: c.walls,
    includeObjects: c.objects,
    includeTokens: c.tokens,
    includeNotes: c.notes,
    revealSecrets: c.secrets,
    background: bg,
    gridColor: doc.grid.color,
    gridOpacity: doc.grid.opacity,
  })

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const downloadPng = () =>
    run(async () => {
      const canvas = renderMap(doc, {
        ...renderOpts(content, transparent ? null : background),
        cellPx: layout.cellPx,
      })
      downloadBlob(await canvasToBlob(canvas), layout.filename)
      if (fog)
        downloadBlob(
          await canvasToBlob(fogMask(doc, layout.cellPx)),
          layout.filename.replace(/\.png$/, '_fog.png'),
        )
      flash(`Exported ${layout.width}×${layout.height} px`)
    })

  const downloadPdf = () =>
    run(async () => {
      const paper = paperKey === 'custom' ? custom : PAPERS[paperKey]
      const { blob, filename } = exportPdf(doc, {
        paper,
        margin,
        render: renderOpts(printContent, '#ffffff'),
      })
      downloadBlob(blob, filename)
      flash('PDF exported')
    })

  const downloadJson = () =>
    run(async () => {
      const text = JSON.stringify(toPackage(doc), null, 2)
      downloadBlob(new Blob([text], { type: 'application/json' }), packageFilename(doc))
      flash('Map file exported')
    })

  const downloadFoundry = (withImage: boolean) =>
    run(async () => {
      const scene = toFoundryScene(doc, layout.cellPx, layout.filename)
      downloadBlob(
        new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }),
        foundryFilename(doc),
      )
      if (withImage) {
        const canvas = renderMap(doc, {
          ...renderOpts({ ...content, walls: true }, transparent ? null : background),
          cellPx: layout.cellPx,
        })
        downloadBlob(await canvasToBlob(canvas), layout.filename)
      }
      flash('Foundry scene exported')
    })

  let body: ReactNode
  switch (tab) {
    case 'png':
      body = (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cell size (px at 1×)">
              <NumberInput
                aria-label="Export cell size"
                value={cellPx}
                onValue={setCellPx}
                min={10}
                max={400}
              />
            </Field>
            <Field label="Scale">
              <select
                aria-label="Export scale"
                className={inputClass}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              >
                <option value={1}>1×</option>
                <option value={2}>2×</option>
              </select>
            </Field>
            <Field label="Background">
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Background colour"
                  value={background}
                  disabled={transparent}
                  onChange={(e) => setBackground(e.target.value)}
                  className="h-7 w-10 rounded border border-zinc-300 dark:border-zinc-600"
                />
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={(e) => setTransparent(e.target.checked)}
                  />
                  Transparent
                </label>
              </span>
            </Field>
          </div>
          <ContentOptions value={content} onChange={setContent} />
          <Check
            label="Fog of war placeholder"
            hint="Also downloads a solid black mask of the same size (…_fog.png) to use as a starting fog layer. Real fog tools are planned for Combat Mode."
            checked={fog}
            onChange={setFog}
          />
          <p
            data-testid="png-output"
            className="rounded bg-zinc-100 px-3 py-2 font-mono text-sm dark:bg-zinc-800"
          >
            {layout.width} × {layout.height} px · {layout.cellPx} px per cell · {layout.filename}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Grid-aligned: every cell is exactly {layout.cellPx} whole pixels and cell A1 starts at
            pixel (0, 0). In your VTT, set the grid size to <strong>{layout.cellPx} px</strong> and
            each square to {doc.grid.feetPerCell} ft. See docs/vtt-export.md.
          </p>
          {(tooBig || !cellOk) && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {!cellOk
                ? 'Cell size must be a whole number from 10 to 400.'
                : 'That image is larger than browsers can create (max 16384 px per side). Lower the cell size or scale.'}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => void downloadPng()}
              disabled={busy || tooBig || !cellOk}
            >
              <Download size={15} aria-hidden /> Download PNG
            </Button>
          </div>
        </div>
      )
      break
    case 'pdf':
      body = (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Paper">
              <select
                aria-label="Paper size"
                className={inputClass}
                value={paperKey}
                onChange={(e) => setPaperKey(e.target.value as typeof paperKey)}
              >
                <option value="letter">{PAPERS.letter.label}</option>
                <option value="a4">{PAPERS.a4.label}</option>
                <option value="custom">Custom…</option>
              </select>
            </Field>
            <Field label="Margin (mm)">
              <NumberInput
                value={margin}
                onValue={(m) => setMargin(Math.max(0, m || 0))}
                min={0}
                max={50}
              />
            </Field>
            {paperKey === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Width (mm)">
                  <NumberInput
                    value={custom.w}
                    onValue={(w) => setCustom({ ...custom, w })}
                    min={50}
                    max={2000}
                  />
                </Field>
                <Field label="Height (mm)">
                  <NumberInput
                    value={custom.h}
                    onValue={(h) => setCustom({ ...custom, h })}
                    min={50}
                    max={2000}
                  />
                </Field>
              </div>
            )}
          </div>
          <ContentOptions value={printContent} onChange={setPrintContent} />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            The map is scaled to fit one page (orientation picked automatically) on a white
            background, with the map name and a scale bar in feet.
          </p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => void downloadPdf()} disabled={busy}>
              <Download size={15} aria-hidden /> Download PDF
            </Button>
          </div>
        </div>
      )
      break
    case 'json':
      body = (
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Saves the complete map (terrain, walls, props, tokens, notes, layers, grid, seed and
            asset flags) as a versioned <code>.dmtk-map.json</code> file. Open it again from{' '}
            <strong>Maps → Import map file</strong>.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Custom tileset images are not embedded. Re-import the tileset on another browser, or
            tiles show as placeholders.
          </p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => void downloadJson()} disabled={busy}>
              <Download size={15} aria-hidden /> Download {doc.name}.dmtk-map.json
            </Button>
          </div>
        </div>
      )
      break
    case 'foundry':
      body = (
        <div className="flex flex-col gap-3 text-sm">
          <p className="rounded border border-amber-400 bg-amber-50 p-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Experimental. Creates a Foundry VTT scene JSON with walls and doors (secret doors as
            Foundry secret doors) at {layout.cellPx} px per cell, using the PNG settings from the
            Image tab. Field names target Foundry v11–v12:{' '}
            <strong>verify in your Foundry version</strong>.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            In Foundry: create a scene, upload the PNG as its background, then right-click the scene
            → Import Data and pick the JSON. Walls are exported regardless of the "Walls" checkbox
            so vision works.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => void downloadFoundry(false)} disabled={busy || tooBig}>
              Scene JSON only
            </Button>
            <Button
              variant="primary"
              onClick={() => void downloadFoundry(true)}
              disabled={busy || tooBig}
            >
              <Download size={15} aria-hidden /> PNG + scene JSON
            </Button>
          </div>
        </div>
      )
      break
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Export format" className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1 text-sm ${
              tab === t.id
                ? 'bg-amber-500 text-zinc-950'
                : 'border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{body}</div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Export failed: {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={onDone}>Close</Button>
      </div>
    </div>
  )
}

export function ExportDialog() {
  const open = useEditorStore((s) => s.exportOpen)
  const set = useEditorStore((s) => s.set)
  const close = () => set({ exportOpen: false })
  return (
    <Modal open={open} title="Export map" onClose={close} wide>
      <ExportForm onDone={close} />
    </Modal>
  )
}
