// Combat controls in the Map Creator sidebar: turn, movement, area templates with
// the creatures inside them, reach/range rings, and selection sync with the tracker.

import { useEffect, useMemo, useState } from 'react'
import { Button, inputClass, Panel } from '../../app/ui'
import { endTurn } from '../actions'
import { useCombatStore } from '../../board/initiative/store'
import type { Combatant } from '../../board/initiative/model'
import { selectTool } from '../../mapcreator/actions'
import { useEditorStore } from '../../mapcreator/store/editorStore'
import { useMapStore } from '../../mapcreator/store/mapStore'
import { combatantForToken, tokenForCombatant } from '../links'
import {
  TEMPLATE_SHAPES,
  templateCellsOnMap,
  tokensInCells,
  type TemplateShape,
} from '../templates'
import { AreaEffect, ConcentrationPrompts, Reminders } from './CombatPieces'

const RING_PRESETS = [5, 10, 15, 30, 60]

/** Keeps the tracker's selected creature and the map's selected token in step. */
function useSelectionSync() {
  const selectedId = useCombatStore((s) => s.state.selectedId)
  const combatants = useCombatStore((s) => s.state.combatants)
  const selection = useEditorStore((s) => s.selection)
  const mapId = useMapStore((s) => s.doc.id)

  // Tracker → map: selecting a creature selects its token.
  useEffect(() => {
    const token = tokenForCombatant(
      combatants.find((c) => c.id === selectedId),
      mapId,
    )
    const ed = useEditorStore.getState()
    if (!token || !useMapStore.getState().doc.props[token]) return
    const cur = ed.selection
    if (cur.layer === 'tokens' && cur.ids.length === 1 && cur.ids[0] === token) return
    ed.set({ selection: { layer: 'tokens', ids: [token] } })
    // Only react to the tracker's choice, not to map selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, mapId])

  // Map → tracker: selecting a linked token selects its creature.
  useEffect(() => {
    if (selection.layer !== 'tokens' || selection.ids.length !== 1) return
    const c = combatantForToken({ combatants }, mapId, selection.ids[0])
    if (!c) return
    const store = useCombatStore.getState()
    if (store.state.selectedId !== c.id) store.update((s) => ({ ...s, selectedId: c.id }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, mapId])
}

function TemplateSection() {
  const ed = useEditorStore()
  const doc = useMapStore((s) => s.doc)
  const combatants = useCombatStore((s) => s.state.combatants)
  const shape = TEMPLATE_SHAPES.find((t) => t.id === ed.templateShape)!

  const inside = useMemo(() => {
    if (!ed.template) return null
    const ids = tokensInCells(doc, templateCellsOnMap(ed.template, doc))
    const linked: Combatant[] = []
    const loose: string[] = []
    for (const id of ids) {
      const c = combatantForToken({ combatants }, doc.id, id)
      if (c) linked.push(c)
      else loose.push(doc.props[id]?.token?.name ?? 'Token')
    }
    return { linked, loose, squares: templateCellsOnMap(ed.template, doc).length }
  }, [ed.template, doc, combatants])

  const setShape = (templateShape: TemplateShape) =>
    ed.set({
      templateShape,
      template: ed.template ? { ...ed.template, shape: templateShape } : null,
    })
  const setSize = (v: string) => {
    const n = Math.max(5, Math.round(Number(v) || 5))
    ed.set({ templateSize: n, template: ed.template ? { ...ed.template, sizeFt: n } : null })
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex flex-col gap-0.5">
          Shape
          <select
            aria-label="Template shape"
            className={inputClass}
            value={ed.templateShape}
            onChange={(e) => setShape(e.target.value as TemplateShape)}
          >
            {TEMPLATE_SHAPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          {shape.sizeLabel}
          <input
            type="number"
            min={5}
            step={5}
            aria-label="Template size"
            className={inputClass}
            value={ed.templateSize}
            onChange={(e) => setSize(e.target.value)}
          />
        </label>
      </div>
      <div className="flex gap-1">
        <Button
          className="!px-2 !py-0.5 text-xs"
          aria-pressed={ed.tool === 'template'}
          onClick={() => selectTool('template')}
        >
          Place template (A)
        </Button>
        <Button
          className="!px-2 !py-0.5 text-xs"
          disabled={!ed.template}
          onClick={() => ed.set({ template: null })}
        >
          Clear
        </Button>
      </div>
      <p className="text-zinc-500">
        {ed.tool === 'template'
          ? 'Click to place. For cones and lines, drag to aim. Esc clears.'
          : 'Squares are picked by their centres. A DM aid; you decide edge cases.'}
      </p>
      {inside && (
        <div data-testid="template-result">
          <p className="font-semibold">
            {inside.squares} squares · {inside.linked.length + inside.loose.length} token
            {inside.linked.length + inside.loose.length === 1 ? '' : 's'} inside
          </p>
          {inside.loose.length > 0 && (
            <p className="text-amber-700 dark:text-amber-400">
              Not in initiative (add them to damage them here): {inside.loose.join(', ')}
            </p>
          )}
          <AreaEffect
            candidates={inside.linked}
            emptyHint="No creatures from the initiative tracker are inside."
          />
        </div>
      )}
    </div>
  )
}

function RingsSection() {
  const rings = useEditorStore((s) => s.rings)
  const set = useEditorStore((s) => s.set)
  const [custom, setCustom] = useState('')
  const toggle = (ft: number) =>
    set({ rings: rings.includes(ft) ? rings.filter((r) => r !== ft) : [...rings, ft] })
  const extras = rings.filter((r) => !RING_PRESETS.includes(r))
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Reach and range rings">
        {RING_PRESETS.map((ft) => (
          <button
            key={ft}
            type="button"
            aria-pressed={rings.includes(ft)}
            onClick={() => toggle(ft)}
            className={`rounded border px-1.5 py-0.5 ${
              rings.includes(ft)
                ? 'border-sky-500 bg-sky-500 text-white'
                : 'border-zinc-300 dark:border-zinc-600'
            }`}
          >
            {ft} ft
          </button>
        ))}
        {extras.map((ft) => (
          <button
            key={ft}
            type="button"
            aria-pressed
            onClick={() => toggle(ft)}
            className="rounded border border-sky-500 bg-sky-500 px-1.5 py-0.5 text-white"
            title="Remove this ring"
          >
            {ft} ft ×
          </button>
        ))}
      </div>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          const n = Math.round(Number(custom))
          if (n > 0 && !rings.includes(n)) set({ rings: [...rings, n] })
          setCustom('')
        }}
      >
        <input
          aria-label="Custom ring distance (ft)"
          className={inputClass}
          inputMode="numeric"
          placeholder="Custom ft, e.g. 120"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button type="submit" className="!px-2 !py-0.5 text-xs">
          Add
        </Button>
      </form>
      <p className="text-zinc-500">
        Drawn around the selected token, or the active creature when none is selected.
      </p>
    </div>
  )
}

export function MapCombatPanel() {
  useSelectionSync()
  const load = useCombatStore((s) => s.load)
  const state = useCombatStore((s) => s.state)
  const update = useCombatStore((s) => s.update)
  const autoInitiative = useEditorStore((s) => s.autoInitiative)
  const set = useEditorStore((s) => s.set)
  useEffect(() => {
    void load()
  }, [load])

  const active = state.combatants.find((c) => c.id === state.activeId)
  return (
    <Panel title="Combat">
      <div className="flex flex-col gap-2 text-xs" data-testid="map-combat">
        <div className="flex items-center gap-2">
          <span className="flex-1">
            <strong>Round {state.round}</strong>
            {active ? (
              <>
                {' · '}
                <span data-testid="active-name">{active.name}</span>
                {active.speed ? ` · moved ${active.movedFt ?? 0}/${active.speed} ft` : ''}
              </>
            ) : (
              ' · no active creature'
            )}
          </span>
          <Button
            variant="primary"
            className="!px-2 !py-0.5 text-xs"
            disabled={!state.combatants.length}
            onClick={() => update(endTurn)}
          >
            Next turn
          </Button>
        </div>
        <Reminders />
        <ConcentrationPrompts />
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={autoInitiative}
            onChange={(e) => set({ autoInitiative: e.target.checked })}
          />
          Add new creature tokens to initiative
        </label>
        <details open>
          <summary className="cursor-pointer font-semibold">Area template</summary>
          <div className="pt-1">
            <TemplateSection />
          </div>
        </details>
        <details>
          <summary className="cursor-pointer font-semibold">Reach and range rings</summary>
          <div className="pt-1">
            <RingsSection />
          </div>
        </details>
      </div>
    </Panel>
  )
}
