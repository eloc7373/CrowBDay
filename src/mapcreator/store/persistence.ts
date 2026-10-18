import { db } from '../../lib/db'
import type { MapDoc } from '../layers/model'
import { assetMeta, getAsset } from '../tilesets/registry'
import { useMapStore } from './mapStore'

const LAST_MAP_KEY = 'lastMapId'
const AUTOSAVE_MS = 800

function looksLikeMap(doc: unknown): doc is MapDoc {
  const d = doc as Partial<MapDoc> | undefined
  return (
    !!d &&
    typeof d.id === 'string' &&
    !!d.grid &&
    !!d.layers &&
    !!d.tiles &&
    !!d.walls &&
    !!d.props &&
    !!d.notes
  )
}

/**
 * Upgrades maps saved by earlier builds: adds the `assets` metadata table and
 * back-fills entries for every referenced asset that is installed.
 */
export function normalizeDoc(doc: MapDoc): MapDoc {
  const assets = { ...(doc.assets ?? {}) }
  const ids = new Set([
    ...Object.values(doc.tiles),
    ...Object.values(doc.props).map((p) => p.defId),
  ])
  for (const id of ids) {
    if (assets[id]) continue
    const def = getAsset(id)
    if (def) assets[id] = assetMeta(def)
  }
  return { ...doc, assets }
}

let restored = false

/** Loads the most recently edited map, if any. Only runs once per session. */
export async function restoreLastMap(): Promise<boolean> {
  if (restored) return false
  restored = true
  try {
    const last = await db.settings.get(LAST_MAP_KEY)
    if (typeof last?.value !== 'string') return false
    const saved = await db.maps.get(last.value)
    if (!saved || !looksLikeMap(saved.doc)) return false
    useMapStore.getState().loadDoc(normalizeDoc(saved.doc))
    return true
  } catch (err) {
    console.warn('Could not restore the last map', err)
    return false
  }
}

export async function saveMap(doc: MapDoc): Promise<void> {
  const updatedAt = new Date().toISOString()
  await db.transaction('rw', db.maps, db.settings, async () => {
    await db.maps.put({ id: doc.id, name: doc.name, updatedAt, doc: { ...doc, updatedAt } })
    await db.settings.put({ key: LAST_MAP_KEY, value: doc.id })
  })
}

/** Debounced save of the current map whenever it changes. Returns a stop function. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let last = useMapStore.getState().doc
  let pending = false
  const flush = () => {
    clearTimeout(timer)
    if (!pending) return
    pending = false
    saveMap(last).catch((err) => console.warn('Autosave failed', err))
  }
  const unsubscribe = useMapStore.subscribe((s) => {
    if (s.doc === last) return
    // Switching to another map (new/open/import): save the outgoing one now, or
    // its edits from the last debounce window would be lost.
    if (s.doc.id !== last.id) flush()
    last = s.doc
    pending = true
    clearTimeout(timer)
    timer = setTimeout(flush, AUTOSAVE_MS)
  })
  return () => {
    unsubscribe()
    // Leaving the page within the debounce window must not drop the last edit.
    flush()
  }
}

export interface MapSummary {
  id: string
  name: string
  width: number
  height: number
  updatedAt: string
}

/** Saved maps, most recently edited first. */
export async function listMaps(): Promise<MapSummary[]> {
  const all = await db.maps.orderBy('updatedAt').reverse().toArray()
  return all
    .filter((m) => looksLikeMap(m.doc))
    .map((m) => ({
      id: m.id,
      name: m.name,
      width: m.doc.width,
      height: m.doc.height,
      updatedAt: m.updatedAt,
    }))
}

/** Saves the current map, then opens another saved one. */
export async function openMap(id: string): Promise<boolean> {
  await saveMap(useMapStore.getState().doc)
  const saved = await db.maps.get(id)
  if (!saved || !looksLikeMap(saved.doc)) return false
  useMapStore.getState().loadDoc(normalizeDoc(saved.doc))
  await db.settings.put({ key: LAST_MAP_KEY, value: id })
  return true
}

export async function deleteMap(id: string): Promise<void> {
  await db.maps.delete(id)
}

/** Whether a map with this id is already stored (used to avoid overwriting on import). */
export async function mapExists(id: string): Promise<boolean> {
  return (await db.maps.get(id)) !== undefined
}

export interface RoomMarkerRef {
  mapId: string
  mapName: string
  noteId: string
  number: number
  text: string
}

/** Every numbered room marker in every saved map (for linking session notes). */
export async function listRoomMarkers(): Promise<RoomMarkerRef[]> {
  const maps = await db.maps.orderBy('updatedAt').reverse().toArray()
  return maps.flatMap((m) =>
    looksLikeMap(m.doc)
      ? Object.values(m.doc.notes)
          .filter((n) => n.kind === 'room')
          .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
          .map((n) => ({
            mapId: m.id,
            mapName: m.name,
            noteId: n.id,
            number: n.number ?? 0,
            text: n.text,
          }))
      : [],
  )
}
