// Import a user tileset: either a PNG sprite sheet sliced on a grid, or a PNG
// plus a tileset.json describing named tiles, flags and autotile rules.

import { Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Modal } from '../../app/Modal'
import { Button, Field, inputClass, NumberInput } from '../../app/ui'
import { useEditorStore } from '../store/editorStore'
import { installTileset, removeTileset } from '../tilesets/install'
import { useAssetStore } from '../tilesets/registry'
import type { TilesetFile } from '../tilesets/tilesetFormat'
import { CATEGORY_LABELS, type AssetCategory, type AssetKind } from '../tilesets/types'

const IMAGE_RE = /\.(png|jpe?g|webp)$/i

/** Guesses a tile size that divides the image evenly (VTT sizes first). */
function guessTileSize(w: number, h: number): number {
  for (const s of [70, 64, 100, 50, 32, 128, 48, 16]) if (w % s === 0 && h % s === 0) return s
  return 64
}

const baseName = (n: string) => n.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')

type Mode = 'grid' | 'json'

function ImportForm({ onDone }: { onDone: () => void }) {
  const [image, setImage] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [json, setJson] = useState<{ name: string; data: TilesetFile } | null>(null)
  const [mode, setMode] = useState<Mode>('grid')
  const [name, setName] = useState('')
  const [tileSize, setTileSize] = useState(64)
  const [margin, setMargin] = useState(0)
  const [spacing, setSpacing] = useState(0)
  const [kind, setKind] = useState<AssetKind>('tile')
  const [category, setCategory] = useState<AssetCategory>('terrain')
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => () => void (imageUrl && URL.revokeObjectURL(imageUrl)), [imageUrl])

  // Grid preview over the sheet.
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !imageUrl || !imageSize) return
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 400 / imageSize.w)
      c.width = Math.round(imageSize.w * scale)
      c.height = Math.round(imageSize.h * scale)
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const ts = mode === 'json' ? (json?.data.tileWidth ?? json?.data.tileSize) : tileSize
      const m = mode === 'json' ? (json?.data.margin ?? 0) : margin
      const sp = mode === 'json' ? (json?.data.spacing ?? 0) : spacing
      if (!ts || ts <= 0) return
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)'
      ctx.lineWidth = 1
      for (let x = m; x + ts <= imageSize.w; x += ts + sp) {
        for (let y = m; y + ts <= imageSize.h; y += ts + sp) {
          ctx.strokeRect(x * scale + 0.5, y * scale + 0.5, ts * scale - 1, ts * scale - 1)
        }
      }
    }
    img.src = imageUrl
  }, [imageUrl, imageSize, tileSize, margin, spacing, mode, json])

  async function acceptFiles(files: FileList | File[]) {
    setErrors([])
    const list = [...files]
    const img = list.find((f) => IMAGE_RE.test(f.name) || f.type.startsWith('image/'))
    const js = list.find((f) => f.name.toLowerCase().endsWith('.json'))
    if (js) {
      try {
        const data = JSON.parse(await js.text()) as TilesetFile
        setJson({ name: js.name, data })
        setMode('json')
      } catch (e) {
        setErrors([`${js.name} is not valid JSON: ${(e as Error).message}`])
        return
      }
    }
    if (img) {
      const url = URL.createObjectURL(img)
      const probe = new Image()
      probe.onload = () => {
        setImageSize({ w: probe.naturalWidth, h: probe.naturalHeight })
        setTileSize(guessTileSize(probe.naturalWidth, probe.naturalHeight))
      }
      probe.onerror = () => setErrors([`${img.name} could not be read as an image.`])
      probe.src = url
      setImage(img)
      setImageUrl(url)
      setName((n) => n || baseName(img.name))
    }
    if (!img && !js) setErrors(['Choose a PNG sprite sheet (and optionally its tileset.json).'])
  }

  async function install() {
    if (!image) return setErrors(['Choose the sprite sheet image first.'])
    let file: TilesetFile
    if (mode === 'json') {
      if (!json) return setErrors(['Choose a tileset.json file, or switch to "Slice by grid".'])
      file = json.data
    } else {
      if (!name.trim()) return setErrors(['Give the tileset a name.'])
      file = { name: name.trim(), tileSize, margin, spacing, defaults: { kind, category } }
    }
    setBusy(true)
    const res = await installTileset(file, image)
    setBusy(false)
    if (!res.ok) return setErrors(res.errors)
    useEditorStore
      .getState()
      .flash(`Installed ${res.tileset.assets.length} assets from "${res.tileset.name}"`)
    onDone()
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length) void acceptFiles(e.dataTransfer.files)
  }

  const cols = imageSize
    ? Math.floor((imageSize.w - 2 * margin + spacing) / (tileSize + spacing))
    : 0
  const rows = imageSize
    ? Math.floor((imageSize.h - 2 * margin + spacing) / (tileSize + spacing))
    : 0

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 p-4 text-center text-sm hover:border-amber-500 dark:border-zinc-600"
      >
        <Upload size={20} aria-hidden />
        <span>
          Drop a <strong>PNG sprite sheet</strong> here (plus its <code>tileset.json</code> if it
          has one), or click to choose files.
        </span>
        <input
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.json,image/*,application/json"
          aria-label="Tileset files"
          className="sr-only"
          onChange={(e) => e.target.files && void acceptFiles(e.target.files)}
        />
        {(image || json) && (
          <span className="text-xs text-zinc-500">
            {[image?.name, json?.name].filter(Boolean).join(' + ')}
            {imageSize ? ` · ${imageSize.w}×${imageSize.h} px` : ''}
          </span>
        )}
      </label>

      <div role="radiogroup" aria-label="Import mode" className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === 'grid'} onChange={() => setMode('grid')} />
          Slice by grid
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === 'json'} onChange={() => setMode('json')} />
          Use tileset.json
        </label>
      </div>

      {mode === 'grid' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tileset name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Tile size (px)">
            <NumberInput
              aria-label="Tile size"
              value={tileSize}
              onValue={setTileSize}
              min={4}
              max={1024}
            />
          </Field>
          <Field label="Margin (px)">
            <NumberInput value={margin} onValue={setMargin} min={0} />
          </Field>
          <Field label="Spacing (px)">
            <NumberInput value={spacing} onValue={setSpacing} min={0} />
          </Field>
          <Field label="Import cells as">
            <select
              className={inputClass}
              value={kind}
              onChange={(e) => {
                const k = e.target.value as AssetKind
                setKind(k)
                setCategory(k === 'tile' ? 'terrain' : k === 'token' ? 'tokens' : 'props')
              }}
            >
              <option value="tile">Terrain tiles</option>
              <option value="prop">Props (1×1)</option>
              <option value="token">Tokens</option>
            </select>
          </Field>
          <Field label="Category">
            <select
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
            >
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {imageSize && (
            <p className="col-span-2 text-xs text-zinc-500 dark:text-zinc-400">
              {cols} columns × {rows} rows = {Math.max(0, cols * rows)} cells. Fully transparent
              cells are skipped. Use a tileset.json to name tiles, set movement/sight flags,
              multi-cell props or autotile rules.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {json
            ? `"${json.data.name ?? json.name}" with ${json.data.tiles?.length ?? 'all'} tile entries.`
            : 'Choose a tileset.json together with its PNG. See README → "Adding a tileset" for the format.'}
        </p>
      )}

      {imageUrl && (
        <canvas
          ref={canvasRef}
          aria-label="Sprite sheet preview with grid"
          className="max-h-64 self-center rounded border border-zinc-300 [image-rendering:pixelated] dark:border-zinc-700"
        />
      )}

      {errors.length > 0 && (
        <ul
          role="alert"
          className="list-disc rounded bg-red-50 py-2 pr-2 pl-6 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Only import art you have the right to use. CC0 sources such as Kenney.nl and OpenGameArt
        work well. Tilesets are stored in this browser only.
      </p>

      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="primary" onClick={() => void install()} disabled={busy || !image}>
          {busy ? 'Installing…' : 'Install tileset'}
        </Button>
      </div>
    </div>
  )
}

function InstalledList() {
  const tilesets = useAssetStore((s) => s.tilesets)
  if (!tilesets.length) return null
  return (
    <section className="mb-4" aria-label="Installed tilesets">
      <h3 className="mb-1 text-sm font-semibold">Installed tilesets</h3>
      <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
        {tilesets.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-2 py-1">
            <span>
              {t.name}{' '}
              <span className="text-xs text-zinc-500">
                · {t.assetIds.length} assets{t.license ? ` · ${t.license}` : ''}
              </span>
            </span>
            <Button
              variant="ghost"
              aria-label={`Remove tileset ${t.name}`}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove "${t.name}"? Maps that use it keep their layout but show placeholder art until it is re-imported.`,
                  )
                )
                  void removeTileset(t.id)
              }}
            >
              <Trash2 size={14} aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ImportTilesetDialog() {
  const open = useEditorStore((s) => s.tilesetDialogOpen)
  const set = useEditorStore((s) => s.set)
  const close = () => set({ tilesetDialogOpen: false })
  return (
    <Modal open={open} title="Tilesets" onClose={close} wide>
      <InstalledList />
      <ImportForm onDone={close} />
    </Modal>
  )
}
