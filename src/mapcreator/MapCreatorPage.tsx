import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fitToScreen, focusNote } from './actions'
import { MapCanvas } from './canvas/MapCanvas'
import { useEditorStore } from './store/editorStore'
import { useMapStore } from './store/mapStore'
import { openMap, restoreLastMap, startAutosave } from './store/persistence'
import { loadInstalledTilesets } from './tilesets/install'
import { useCombatStore } from '../board/initiative/store'
import { MapCombatPanel } from '../combat/ui/MapCombatPanel'
import { AssetLibrary } from './ui/AssetLibrary'
import { GridPanel } from './ui/GridPanel'
import { ExportDialog } from './ui/ExportDialog'
import { GenerateDialog } from './ui/GenerateDialog'
import { HelpDialog } from './ui/HelpDialog'
import { ImportTilesetDialog } from './ui/ImportTilesetDialog'
import { LabelDialog } from './ui/LabelDialog'
import { LayersPanel } from './ui/LayersPanel'
import { MapsDialog } from './ui/MapsDialog'
import { NewMapDialog } from './ui/NewMapDialog'
import { handleKeyDown, handleKeyUp } from './ui/shortcuts'
import { StatusBar } from './ui/StatusBar'
import { ToolBar } from './ui/ToolBar'
import { ToolOptions } from './ui/ToolOptions'
import { TokenPanel } from './ui/TokenPanel'
import { TopBar } from './ui/TopBar'

export default function MapCreatorPage() {
  const [, setSearchParams] = useSearchParams()
  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    // Tilesets first, so the restored map renders with its custom art.
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    const linkedMap = params.get('map')
    const linkedNote = params.get('focus')
    loadInstalledTilesets()
      .then(restoreLastMap)
      .then(async () => {
        // Room link from the DM Board: open that map if it isn't the current one.
        if (linkedMap && linkedMap !== useMapStore.getState().doc.id) await openMap(linkedMap)
      })
      .then(() => {
        if (cancelled) return
        requestAnimationFrame(() => {
          fitToScreen()
          if (linkedNote) focusNote(linkedNote)
          if (linkedMap || linkedNote) setSearchParams({}, { replace: true })
        })
        stop = startAutosave()
      })
    const onBlur = () => useEditorStore.getState().set({ spaceHeld: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', onBlur)
    // Test/debug hook (dev builds only) so e2e tests can inspect map state.
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__dmtk = {
        map: useMapStore,
        editor: useEditorStore,
        combat: useCombatStore,
      }
    }
    return () => {
      cancelled = true
      stop?.()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', onBlur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolBar />
        <main className="relative min-w-0 flex-1" aria-label="Map canvas area">
          <MapCanvas />
        </main>
        <aside
          aria-label="Map properties"
          className="w-72 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        >
          <ToolOptions />
          <TokenPanel />
          <MapCombatPanel />
          <LayersPanel />
          <AssetLibrary />
          <GridPanel />
        </aside>
      </div>
      <StatusBar />
      <HelpDialog />
      <NewMapDialog />
      <LabelDialog />
      <ImportTilesetDialog />
      <GenerateDialog />
      <ExportDialog />
      <MapsDialog />
    </div>
  )
}
