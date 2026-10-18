import { Eye, MapPin, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, inputClass } from '../../app/ui'
import type { SessionNote } from '../../lib/db'
import { listRoomMarkers, type RoomMarkerRef } from '../../mapcreator/store/persistence'
import { Markdown } from '../ui/Markdown'
import { roomHref } from '../ui/uiStore'
import { orderedNotes, useNotesStore } from './store'

function RoomLinkPicker({ onPick }: { onPick: (markdown: string) => void }) {
  const [rooms, setRooms] = useState<RoomMarkerRef[] | null>(null)
  useEffect(() => {
    void listRoomMarkers()
      .then(setRooms)
      .catch(() => setRooms([]))
  }, [])
  return (
    <select
      aria-label="Link a map room"
      className={`${inputClass} w-auto max-w-48 text-xs`}
      value=""
      onChange={(e) => {
        const r = rooms?.find((x) => `${x.mapId}/${x.noteId}` === e.target.value)
        if (r) onPick(`[Room ${r.number}: ${r.text}](${roomHref(r.mapId, r.noteId)})`)
      }}
    >
      <option value="">📍 Link a map room…</option>
      {rooms === null && <option disabled>Loading…</option>}
      {rooms?.length === 0 && <option disabled>No room markers in saved maps</option>}
      {rooms?.map((r) => (
        <option key={`${r.mapId}/${r.noteId}`} value={`${r.mapId}/${r.noteId}`}>
          {r.mapName} · #{r.number} {r.text}
        </option>
      ))}
    </select>
  )
}

function Editor({ note }: { note: SessionNote }) {
  const edit = useNotesStore((s) => s.edit)
  const remove = useNotesStore((s) => s.remove)
  const [preview, setPreview] = useState(false)
  const [tagText, setTagText] = useState(note.tags.join(', '))
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const insert = (text: string) => {
    const ta = bodyRef.current
    const start = ta?.selectionStart ?? note.body.length
    const end = ta?.selectionEnd ?? note.body.length
    edit(note.id, { body: note.body.slice(0, start) + text + note.body.slice(end) })
    setPreview(false)
    requestAnimationFrame(() => {
      ta?.focus()
      ta?.setSelectionRange(start + text.length, start + text.length)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <input
          aria-label="Note title"
          className={`${inputClass} font-semibold`}
          value={note.title}
          onChange={(e) => edit(note.id, { title: e.target.value })}
        />
        <Button
          variant="ghost"
          className="!px-1"
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          aria-pressed={!!note.pinned}
          onClick={() => edit(note.id, { pinned: note.pinned ? 0 : 1 })}
        >
          {note.pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          className="!px-1"
          aria-label="Delete note"
          onClick={() => window.confirm(`Delete "${note.title}"?`) && void remove(note.id)}
        >
          <Trash2 size={15} aria-hidden />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <input
          aria-label="Tags (comma separated)"
          placeholder="tags, comma separated"
          className={`${inputClass} text-xs`}
          value={tagText}
          onChange={(e) => {
            setTagText(e.target.value)
            edit(note.id, {
              tags: [
                ...new Set(
                  e.target.value
                    .split(',')
                    .map((t) => t.trim().toLowerCase())
                    .filter(Boolean),
                ),
              ],
            })
          }}
        />
        <RoomLinkPicker onPick={insert} />
        <Button
          variant="ghost"
          className="!px-1.5 text-xs"
          onClick={() => setPreview(!preview)}
          aria-pressed={preview}
        >
          {preview ? <Pencil size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          {preview ? 'Edit' : 'Preview'}
        </Button>
      </div>
      {preview ? (
        <div
          className="min-h-32 flex-1 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-700"
          data-testid="note-preview"
        >
          {note.body.trim() ? (
            <Markdown>{note.body}</Markdown>
          ) : (
            <p className="text-sm text-zinc-500">Nothing yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={bodyRef}
          aria-label="Note text (markdown)"
          className={`${inputClass} min-h-32 flex-1 resize-none font-mono text-xs`}
          value={note.body}
          placeholder={
            'Markdown: # heading, **bold**, - list\nUse "Link a map room" to jump to a room marker.'
          }
          onChange={(e) => edit(note.id, { body: e.target.value })}
        />
      )}
    </div>
  )
}

export function NotesStatus() {
  const dirty = useNotesStore((s) => s.dirty.size)
  const lastSavedAt = useNotesStore((s) => s.lastSavedAt)
  return (
    <span className="text-[11px] text-zinc-500" aria-live="polite" data-testid="notes-status">
      {dirty
        ? 'Unsaved… (autosaves every 2 s)'
        : lastSavedAt
          ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
          : 'All saved'}
    </span>
  )
}

export function NotesPanel() {
  const notes = useNotesStore((s) => s.notes)
  const selectedId = useNotesStore((s) => s.selectedId)
  const select = useNotesStore((s) => s.select)
  const create = useNotesStore((s) => s.create)
  const load = useNotesStore((s) => s.load)
  const [filter, setFilter] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes])
  const shown = orderedNotes(notes).filter(
    (n) =>
      (!tag || n.tags.includes(tag)) &&
      (!filter || `${n.title}\n${n.body}`.toLowerCase().includes(filter.toLowerCase())),
  )
  const selected = notes.find((n) => n.id === selectedId) ?? null

  return (
    <div className="flex h-full gap-2">
      <div className="flex w-2/5 min-w-32 flex-col gap-1">
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search
              size={12}
              className="absolute top-1/2 left-1.5 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              aria-label="Filter notes"
              placeholder="Filter"
              className={`${inputClass} pl-5 text-xs`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            className="!px-1.5"
            aria-label="New note"
            onClick={() => create()}
          >
            <Plus size={14} aria-hidden />
          </Button>
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-0.5" role="group" aria-label="Filter by tag">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
                className={`rounded-full border px-1.5 text-[10px] ${tag === t ? 'border-amber-500 bg-amber-500 text-zinc-950' : 'border-zinc-300 dark:border-zinc-600'}`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
        <ul aria-label="Notes" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {shown.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => select(n.id)}
                aria-current={n.id === selectedId}
                className={`w-full rounded px-1.5 py-1 text-left text-xs ${n.id === selectedId ? 'bg-amber-100 dark:bg-amber-500/15' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
              >
                <span className="flex items-center gap-1 font-medium">
                  {n.pinned ? (
                    <Pin size={10} className="shrink-0 text-amber-600" aria-label="Pinned" />
                  ) : null}
                  <span className="truncate">{n.title || 'Untitled'}</span>
                  {/dmtk-room:/.test(n.body) && (
                    <MapPin
                      size={10}
                      className="shrink-0 text-red-500"
                      aria-label="Links to a map room"
                    />
                  )}
                </span>
                <span className="block truncate text-[10px] text-zinc-500">
                  {n.body.replace(/[#*_>`[\]]/g, '').slice(0, 60) || '—'}
                </span>
              </button>
            </li>
          ))}
          {!shown.length && (
            <li className="p-2 text-xs text-zinc-500">
              {notes.length ? 'No matching notes.' : 'No notes yet.'}
            </li>
          )}
        </ul>
      </div>
      {selected ? (
        <Editor key={selected.id} note={selected} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Select or create a note.
        </div>
      )}
    </div>
  )
}
