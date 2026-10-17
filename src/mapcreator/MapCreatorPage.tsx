import { useEffect } from 'react'
import { fitToScreen } from './actions'
import { MapCanvas } from './canvas/MapCanvas'
import { useEditorStore } from './store/editorStore'
import { useMapStore } from './store/mapStore'
import { restoreLastMap, startAutosave } from './store/persistence'
import { loadInstalledTilesets } from './tilesets/install'
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
  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    // Tilesets first, so the restored map renders with its custom art.
    loadInstalledTilesets()
      .then(restoreLastMap)
      .then(() => {
        if (cancelled) return
        requestAnimationFrame(fitToScreen)
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
      }
    }
    return () => {
      cancelled = true
      stop?.()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', onBlur)
    }
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
