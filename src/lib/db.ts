import Dexie, { type Table } from 'dexie'
import type { MapDoc } from '../mapcreator/layers/model'

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

/** Local-only IndexedDB storage. Later phases add tables via new versions. */
class DmDatabase extends Dexie {
  maps!: Table<SavedMap, string>
  settings!: Table<Setting, string>

  constructor() {
    super('dm-toolkit')
    this.version(1).stores({
      maps: 'id, name, updatedAt',
      settings: 'key',
    })
  }
}

export const db = new DmDatabase()
