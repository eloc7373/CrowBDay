// Asset library: search, filter by category/tag/source, recently used, click to
// arm a tool, or drag onto the canvas.

import { FolderInput, Search, X } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { Button, inputClass, Panel } from '../../app/ui'
import { chooseAsset } from '../actions'
import { ASSET_DRAG_TYPE } from '../canvas/MapCanvas'
import { useEditorStore } from '../store/editorStore'
import { getAsset, useAssetStore } from '../tilesets/registry'
import { searchAssets, topTags } from '../tilesets/search'
import { getSprite } from '../tilesets/spriteCache'
import {
  ASSET_CATEGORIES,
  CATEGORY_LABELS,
  type AssetCategory,
  type AssetDef,
} from '../tilesets/types'

const MAX_SHOWN = 200

const Thumb = memo(function Thumb({ def, version }: { def: AssetDef; version: number }) {
  // `version` busts the memo when tileset art is replaced.
  const url = useMemo(() => getSprite(def, 40).toDataURL(), [def, version]) // eslint-disable-line react-hooks/exhaustive-deps
  return <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />
})

function AssetButton({
  def,
  selected,
  version,
}: {
  def: AssetDef
  selected: boolean
  version: number
}) {
  const flags = [
    def.blocksMovement && 'blocks movement',
    def.blocksSight && 'blocks sight',
    def.difficultTerrain && 'difficult terrain',
  ].filter(Boolean)
  return (
    <button
      type="button"
      data-asset={def.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_DRAG_TYPE, def.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      title={`${def.name} · ${def.footprint.w}×${def.footprint.h}${flags.length ? ` · ${flags.join(', ')}` : ''}\n${def.source}${def.tags.length ? ` · ${def.tags.join(', ')}` : ''}`}
      aria-label={def.name}
      aria-pressed={selected}
      onClick={() => chooseAsset(def)}
      className={`flex flex-col items-center gap-0.5 rounded border-2 p-0.5 text-[10px] leading-tight ${
        selected
          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
          : 'border-transparent hover:border-zinc-400'
      }`}
    >
      <span className="aspect-square w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
        <Thumb def={def} version={version} />
      </span>
      <span className="w-full truncate text-zinc-700 dark:text-zinc-300">{def.name}</span>
    </button>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[11px] ${
        active
          ? 'border-amber-500 bg-amber-500 text-zinc-950'
          : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  )
}

export function AssetLibrary() {
  const assets = useAssetStore((s) => s.assets)
  const tilesets = useAssetStore((s) => s.tilesets)
  const version = useAssetStore((s) => s.version)
  const terrainId = useEditorStore((s) => s.terrainId)
  const stampId = useEditorStore((s) => s.stampId)
  const recentIds = useEditorStore((s) => s.recent)
  const set = useEditorStore((s) => s.set)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<AssetCategory | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [source, setSource] = useState<string | null>(null)

  const base = useMemo(
    () => searchAssets(assets, { query, category, source }),
    [assets, query, category, source],
  )
  const results = useMemo(
    () => (tags.length ? base.filter((a) => tags.every((t) => a.tags.includes(t))) : base),
    [base, tags],
  )
  const tagChoices = useMemo(() => [...new Set([...tags, ...topTags(base, 10)])], [base, tags])
  const recent = recentIds.map((id) => getAsset(id)).filter((d): d is AssetDef => !!d)

  const isSelected = (d: AssetDef) => (d.kind === 'tile' ? d.id === terrainId : d.id === stampId)
  const filtered = query || category || tags.length || source
  const sources = ['Built-in', ...tilesets.map((t) => t.name)]

  return (
    <Panel
      title="Asset library"
      actions={
        <Button
          variant="ghost"
          className="!px-1.5 !py-0.5 text-xs"
          onClick={() => set({ tilesetDialogOpen: true })}
        >
          <FolderInput size={14} aria-hidden /> Import tileset
        </Button>
      }
    >
      <div className="relative mb-2">
        <Search
          size={14}
          className="absolute top-1/2 left-2 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          type="search"
          aria-label="Search assets"
          placeholder="Search… e.g. stone, water, table"
          className={`${inputClass} pl-7`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="mb-1.5 flex flex-wrap gap-1" role="group" aria-label="Category filter">
        <Chip active={!category} onClick={() => setCategory(null)}>
          All
        </Chip>
        {ASSET_CATEGORIES.map((c) => (
          <Chip
            key={c}
            active={category === c}
            onClick={() => setCategory(category === c ? null : c)}
          >
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>
      {sources.length > 1 && (
        <select
          aria-label="Source filter"
          className={`${inputClass} mb-1.5 text-xs`}
          value={source ?? ''}
          onChange={(e) => setSource(e.target.value || null)}
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Tag filter">
        {tagChoices.map((t) => (
          <Chip
            key={t}
            active={tags.includes(t)}
            onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
          >
            {`#${t}`}
          </Chip>
        ))}
        {filtered ? (
          <button
            type="button"
            className="flex items-center gap-0.5 text-[11px] text-zinc-500 hover:underline"
            onClick={() => (setQuery(''), setCategory(null), setTags([]), setSource(null))}
          >
            <X size={11} aria-hidden /> clear
          </button>
        ) : null}
      </div>

      {!filtered && recent.length > 0 && (
        <div className="mb-2">
          <h4 className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">Recently used</h4>
          <div className="grid grid-cols-5 gap-1" data-testid="recent-assets">
            {recent.slice(0, 5).map((d) => (
              <AssetButton key={d.id} def={d} selected={isSelected(d)} version={version} />
            ))}
          </div>
        </div>
      )}

      <h4 className="mb-1 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {results.length} {results.length === 1 ? 'asset' : 'assets'}
        {results.length > MAX_SHOWN ? ` (showing ${MAX_SHOWN})` : ''} · drag onto the map or click
        to use
      </h4>
      <div className="grid grid-cols-4 gap-1" data-testid="asset-results">
        {results.slice(0, MAX_SHOWN).map((d) => (
          <AssetButton key={d.id} def={d} selected={isSelected(d)} version={version} />
        ))}
      </div>
      {results.length === 0 && (
        <p className="py-3 text-center text-xs text-zinc-500">
          No assets match. Try another word or clear the filters.
        </p>
      )}
    </Panel>
  )
}
