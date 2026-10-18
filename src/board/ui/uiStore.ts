import { create } from 'zustand'

/** Global (app-wide) board UI state: the search palette and the entry viewer. */
export const useBoardUi = create<{
  searchOpen: boolean
  viewerId: string | null
  openSearch(): void
  closeSearch(): void
  openEntry(id: string): void
  closeEntry(): void
}>()((set) => ({
  searchOpen: false,
  viewerId: null,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openEntry: (id) => set({ viewerId: id, searchOpen: false }),
  closeEntry: () => set({ viewerId: null }),
}))

/** Markdown link target for a map room marker: dmtk-room:<mapId>/<noteId> */
export const roomHref = (mapId: string, noteId: string) => `dmtk-room:${mapId}/${noteId}`

export function parseRoomHref(href: string): { mapId: string; noteId: string } | null {
  const m = /^dmtk-room:([^/]+)\/(.+)$/.exec(href)
  return m ? { mapId: m[1], noteId: m[2] } : null
}
