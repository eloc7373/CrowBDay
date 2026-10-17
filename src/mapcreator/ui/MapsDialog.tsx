// Map library: every map saved in this browser, plus import of .dmtk-map.json files.

import { FolderOpen, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '../../app/Modal'
import { Button } from '../../app/ui'
import { newId } from '../../lib/id'
import { fitToScreen } from '../actions'
import { PackageError, parsePackage } from '../export/mapPackage'
import { useEditorStore } from '../store/editorStore'
import { useMapStore } from '../store/mapStore'
import {
  deleteMap,
  listMaps,
  mapExists,
  normalizeDoc,
  openMap,
  saveMap,
  type MapSummary,
} from '../store/persistence'

function afterLoad() {
  useEditorStore.getState().set({ selection: { layer: 'objects', ids: [] }, preview: null })
  requestAnimationFrame(fitToScreen)
}

function MapsList({ onDone }: { onDone: () => void }) {
  const currentId = useMapStore((s) => s.doc.id)
  const [maps, setMaps] = useState<MapSummary[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const refresh = () =>
    saveMap(useMapStore.getState().doc)
      .then(listMaps)
      .then(setMaps)
      .catch(() => setMaps([]))
  useEffect(() => {
    void refresh()
  }, [])

  const importFile = async (file: File) => {
    setErrors([])
    try {
      let doc = normalizeDoc(parsePackage(await file.text()))
      // Never silently overwrite a saved map: import as a copy instead.
      if (await mapExists(doc.id))
        doc = { ...doc, id: newId('map'), name: `${doc.name} (imported)` }
      await saveMap(useMapStore.getState().doc)
      useMapStore.getState().loadDoc(doc)
      await saveMap(doc)
      useEditorStore.getState().flash(`Imported "${doc.name}"`)
      afterLoad()
      onDone()
    } catch (e) {
      setErrors(e instanceof PackageError ? e.errors : [(e as Error).message])
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-amber-500 dark:bg-amber-500 dark:text-zinc-950">
          <Upload size={15} aria-hidden /> Import map file…
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Map file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
        </label>
        <Button
          onClick={() => {
            onDone()
            useEditorStore.getState().set({ newMapOpen: true })
          }}
        >
          New map…
        </Button>
      </div>
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          <p className="font-semibold">That file could not be imported:</p>
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {maps === null ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <ul
          aria-label="Saved maps"
          className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          {maps.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="flex-1">
                <span className="font-medium">{m.name}</span>
                {m.id === currentId && (
                  <span className="ml-2 rounded bg-amber-500/20 px-1.5 text-xs text-amber-700 dark:text-amber-300">
                    open
                  </span>
                )}
                <span className="block text-xs text-zinc-500">
                  {m.width}×{m.height} · edited {new Date(m.updatedAt).toLocaleString()}
                </span>
              </span>
              <Button
                aria-label={`Open ${m.name}`}
                disabled={m.id === currentId}
                onClick={() =>
                  void openMap(m.id).then((ok) => {
                    if (ok) {
                      afterLoad()
                      onDone()
                    }
                  })
                }
              >
                <FolderOpen size={14} aria-hidden /> Open
              </Button>
              <Button
                variant="ghost"
                aria-label={`Delete ${m.name}`}
                disabled={m.id === currentId}
                title={m.id === currentId ? 'Open another map before deleting this one' : 'Delete'}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete "${m.name}" from this browser? This cannot be undone. Export it first if you want a copy.`,
                    )
                  )
                    void deleteMap(m.id).then(refresh)
                }}
              >
                <Trash2 size={14} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Maps are stored only in this browser. Use Export → Map file to back them up or move them to
        another device.
      </p>
    </div>
  )
}

export function MapsDialog() {
  const open = useEditorStore((s) => s.mapsOpen)
  const set = useEditorStore((s) => s.set)
  const close = () => set({ mapsOpen: false })
  return (
    <Modal open={open} title="Maps" onClose={close} wide>
      <MapsList onDone={close} />
    </Modal>
  )
}
