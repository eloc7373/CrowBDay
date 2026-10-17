import { Eye, EyeOff, Lock, LockOpen } from 'lucide-react'
import { Panel } from '../../app/ui'
import { LAYER_IDS, LAYER_NAMES } from '../layers/model'
import { useEditorStore } from '../store/editorStore'
import { useMapStore } from '../store/mapStore'

export function LayersPanel() {
  const layers = useMapStore((s) => s.doc.layers)
  const setLayer = useMapStore((s) => s.setLayer)
  const active = useEditorStore((s) => s.activeLayer)
  const set = useEditorStore((s) => s.set)

  return (
    <Panel title="Layers">
      <ul className="flex flex-col gap-1">
        {LAYER_IDS.map((id, i) => {
          const l = layers[id]
          const isActive = id === active
          return (
            <li
              key={id}
              data-layer={id}
              className={`rounded-md border px-2 py-1 ${
                isActive
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                  : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex-1 truncate text-left text-sm"
                  aria-pressed={isActive}
                  aria-label={`Make ${LAYER_NAMES[id]} the active layer`}
                  onClick={() => set({ activeLayer: id, selection: { layer: id, ids: [] } })}
                >
                  <span className="mr-1 font-mono text-xs text-zinc-400">{i + 1}</span>
                  {LAYER_NAMES[id]}
                </button>
                <button
                  type="button"
                  aria-label={`${l.visible ? 'Hide' : 'Show'} ${LAYER_NAMES[id]} layer`}
                  aria-pressed={!l.visible}
                  onClick={() => setLayer(id, { visible: !l.visible })}
                  className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  {l.visible ? (
                    <Eye size={15} aria-hidden />
                  ) : (
                    <EyeOff size={15} className="text-zinc-400" aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`${l.locked ? 'Unlock' : 'Lock'} ${LAYER_NAMES[id]} layer`}
                  aria-pressed={l.locked}
                  onClick={() => setLayer(id, { locked: !l.locked })}
                  className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  {l.locked ? (
                    <Lock size={15} className="text-red-500" aria-hidden />
                  ) : (
                    <LockOpen size={15} aria-hidden />
                  )}
                </button>
              </div>
              {isActive && (
                <label className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Opacity
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={l.opacity}
                    aria-label={`${LAYER_NAMES[id]} opacity`}
                    onChange={(e) => setLayer(id, { opacity: e.target.valueAsNumber })}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="w-8 text-right">{Math.round(l.opacity * 100)}%</span>
                </label>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
