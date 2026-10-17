import { useState, type FormEvent } from 'react'
import { cellLabel } from '../../lib/geometry'
import { newId } from '../../lib/id'
import { Modal } from '../../app/Modal'
import { Button, Field, inputClass } from '../../app/ui'
import type { MapNote } from '../layers/model'
import { useEditorStore, type LabelDraft } from '../store/editorStore'
import { compact, setChange } from '../store/history'
import { useMapStore } from '../store/mapStore'

function nextRoomNumber(notes: Record<string, MapNote>): number {
  return Math.max(0, ...Object.values(notes).map((n) => n.number ?? 0)) + 1
}

function LabelForm({ draft, onDone }: { draft: LabelDraft; onDone: () => void }) {
  const doc = useMapStore.getState().doc
  const existing = draft.id ? doc.notes[draft.id] : undefined
  const [kind, setKind] = useState<MapNote['kind']>(existing?.kind ?? 'label')
  const [text, setText] = useState(existing?.text ?? '')
  const [number, setNumber] = useState(existing?.number ?? nextRoomNumber(doc.notes))

  const save = (e: FormEvent) => {
    e.preventDefault()
    const id = existing?.id ?? newId('note')
    const note: MapNote = {
      id,
      kind,
      x: draft.x,
      y: draft.y,
      text: text.trim() || (kind === 'room' ? `Room ${number}` : 'Label'),
      ...(kind === 'room' ? { number } : {}),
    }
    const s = useMapStore.getState()
    s.commit(existing ? 'Edit note' : 'Add note', compact([setChange(s.doc, 'notes', id, note)]))
    onDone()
  }

  const remove = () => {
    const s = useMapStore.getState()
    if (existing)
      s.commit('Delete note', compact([setChange(s.doc, 'notes', existing.id, undefined)]))
    onDone()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">Cell {cellLabel(draft.x, draft.y)}</p>
      <fieldset className="flex gap-4 text-sm">
        <legend className="sr-only">Note type</legend>
        {(['label', 'room'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5">
            <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
            {k === 'label' ? 'Text label' : 'Numbered room marker'}
          </label>
        ))}
      </fieldset>
      {kind === 'room' && (
        <Field label="Room number">
          <input
            type="number"
            className={inputClass}
            min={1}
            value={number}
            onChange={(e) => setNumber(Math.max(1, e.target.valueAsNumber || 1))}
          />
        </Field>
      )}
      <Field label={kind === 'room' ? 'Room name (used to link session notes later)' : 'Text'}>
        <input
          data-autofocus
          className={inputClass}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <div className="flex justify-between gap-2">
        {existing ? (
          <Button onClick={remove} className="text-red-600 dark:text-red-400">
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onDone}>Cancel</Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </div>
    </form>
  )
}

export function LabelDialog() {
  const draft = useEditorStore((s) => s.labelDraft)
  const set = useEditorStore((s) => s.set)
  const close = () => set({ labelDraft: null })
  return (
    <Modal open={!!draft} title={draft?.id ? 'Edit note' : 'Add note'} onClose={close}>
      {draft && (
        <LabelForm key={`${draft.id}-${draft.x}-${draft.y}`} draft={draft} onDone={close} />
      )}
    </Modal>
  )
}
