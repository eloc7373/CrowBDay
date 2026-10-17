// Phase 1 palette: click a tile to paint it, or a prop/token to arm the Stamp
// tool. Phase 2 replaces this with the searchable asset library.

import { useMemo } from 'react'
import { Panel } from '../../app/ui'
import { selectTool } from '../actions'
import { useEditorStore } from '../store/editorStore'
import { allAssets } from '../tilesets/registry'
import { getSprite } from '../tilesets/spriteCache'
import type { AssetDef } from '../tilesets/types'

const PAINT_TOOLS = ['brush', 'fill', 'rect', 'ellipse']

function Thumb({ def }: { def: AssetDef }) {
  const url = useMemo(() => getSprite(def, 40).toDataURL(), [def])
  return <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />
}

export function AssetPalette() {
  const terrainId = useEditorStore((s) => s.terrainId)
  const stampId = useEditorStore((s) => s.stampId)
  const tool = useEditorStore((s) => s.tool)
  const set = useEditorStore((s) => s.set)
  const assets = allAssets()

  const choose = (def: AssetDef) => {
    if (def.kind === 'tile') {
      set({ terrainId: def.id })
      if (!PAINT_TOOLS.includes(tool)) selectTool('brush')
    } else {
      set({ stampId: def.id })
      selectTool('stamp')
    }
  }

  const groups: { title: string; items: AssetDef[] }[] = [
    { title: 'Terrain', items: assets.filter((a) => a.kind === 'tile') },
    { title: 'Props', items: assets.filter((a) => a.kind === 'prop') },
    { title: 'Tokens', items: assets.filter((a) => a.kind === 'token') },
  ]

  return (
    <Panel title="Assets">
      {groups.map((g) => (
        <div key={g.title} className="mb-2">
          <h4 className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">{g.title}</h4>
          <div className="grid grid-cols-5 gap-1">
            {g.items.map((def) => {
              const selected = def.kind === 'tile' ? def.id === terrainId : def.id === stampId
              return (
                <button
                  key={def.id}
                  type="button"
                  data-asset={def.id}
                  title={`${def.name} (${def.footprint.w}×${def.footprint.h})`}
                  aria-label={def.name}
                  aria-pressed={selected}
                  onClick={() => choose(def)}
                  className={`aspect-square overflow-hidden rounded border-2 bg-zinc-200 p-0.5 dark:bg-zinc-800 ${
                    selected ? 'border-amber-500' : 'border-transparent hover:border-zinc-400'
                  }`}
                >
                  <Thumb def={def} />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </Panel>
  )
}
