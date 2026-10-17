import Dexie, { type Table } from 'dexie'
import type { MapDoc } from '../mapcreator/layers/model'
import type { TilesetFile } from '../mapcreator/tilesets/tilesetFormat'

export interface SavedMap {
  id: string
  name: string
  updatedAt: string
  doc: MapDoc
}

export interface Setting {
  key: string
  value: unknown
}

export interface SavedTileset {
  id: string
  name: string
  file: TilesetFile
  image: Blob
  installedAt: string
}

/** Local-only IndexedDB storage. Later phases add tables via new versions. */
class DmDatabase extends Dexie {
  maps!: Table<SavedMap, string>
  settings!: Table<Setting, string>
  tilesets!: Table<SavedTileset, string>

  constructor() {
    super('dm-toolkit')
    this.version(1).stores({
      maps: 'id, name, updatedAt',
      settings: 'key',
    })
    this.version(2).stores({
      tilesets: 'id, name',
    })
  }
}

export const db = new DmDatabase()
