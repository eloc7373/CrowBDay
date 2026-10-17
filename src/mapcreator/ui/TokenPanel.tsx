// Creature data for the selected token. Every change is an undoable map edit.
// Combat Mode (Phase 5B) will link these tokens to the initiative tracker.

import { useState, type KeyboardEvent } from 'react'
import { Button, inputClass, Panel } from '../../app/ui'
import { canEdit } from '../canvas/controller'
import {
  CREATURE_SIZES,
  defaultTokenInfo,
  TOKEN_SIDES,
  type MapDoc,
  type PlacedProp,
  type TokenInfo,
} from '../layers/model'
import { useEditorStore } from '../store/editorStore'
import { compact, setChange } from '../store/history'
import { useMapStore } from '../store/mapStore'
import { getAsset } from '../tilesets/registry'
import { propRect } from '../tools/paint'

const SIDE_LABELS: Record<TokenInfo['side'], string> = {
  pc: 'Player character',
  ally: 'Ally',
  enemy: 'Enemy',
  neutral: 'Neutral',
}

/** Applies a patch to a token's creature data, keeping the token on the map. */
function commitToken(doc: MapDoc, p: PlacedProp, patch: Partial<TokenInfo>, label = 'Edit token') {
  if (!canEdit('tokens')) return
  const token = { ...(p.token ?? defaultTokenInfo(getAsset(p.defId)?.name ?? 'Token')), ...patch }
  const next = { ...p, token }
  const r = propRect(next)
  next.x = Math.max(0, Math.min(doc.width - r.w, p.x))
  next.y = Math.max(0, Math.min(doc.height - r.h, p.y))
  useMapStore.getState().commit(label, compact([setChange(doc, 'props', p.id, next)]))
}

const parseNum = (s: string): number | null => {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : null
}

/** Text/number input that commits on blur or Enter (one undo step per edit). */
function CommitInput({
  label,
  value,
  onCommit,
  type = 'text',
  className = '',
}: {
  label: string
  value: string
  onCommit: (v: string) => void
  type?: 'text' | 'number'
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const [prev, setPrev] = useState(value)
  // Resync when the stored value changes (undo, another edit).
  if (value !== prev) {
    setPrev(value)
    setDraft(value)
  }
  const commit = () => draft !== value && onCommit(draft)
  return (
    <label
      className={`flex flex-col gap-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 ${className}`}
    >
      {label}
      <input
        type={type}
        aria-label={label}
        className={inputClass}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setDraft(value)
        }}
      />
    </label>
  )
}

function TokenForm({ doc, p }: { doc: MapDoc; p: PlacedProp }) {
  const t = p.token ?? defaultTokenInfo(getAsset(p.defId)?.name ?? 'Token')
  const [amount, setAmount] = useState('')
  const update = (patch: Partial<TokenInfo>, label?: string) => commitToken(doc, p, patch, label)
  const hp = t.hp

  const setHp = (field: 'current' | 'max' | 'temp', v: string) => {
    const n = parseNum(v)
    if (field === 'max' && n === null) return update({ hp: null })
    const base = hp ?? { current: n ?? 0, max: n ?? 0, temp: 0 }
    update({ hp: { ...base, [field]: Math.max(field === 'current' ? -999 : 0, n ?? 0) } })
  }

  // Damage removes temporary HP first, then current HP; healing is capped at max.
  const applyHp = (sign: 1 | -1) => {
    const n = parseNum(amount)
    if (!hp || n === null || n <= 0) return
    if (sign < 0) {
      const fromTemp = Math.min(hp.temp, n)
      update(
        { hp: { ...hp, temp: hp.temp - fromTemp, current: hp.current - (n - fromTemp) } },
        `Damage ${n}`,
      )
    } else {
      update({ hp: { ...hp, current: Math.min(hp.max, Math.max(0, hp.current) + n) } }, `Heal ${n}`)
    }
    setAmount('')
  }

  return (
    <div className="flex flex-col gap-2 text-xs" data-testid="token-panel">
      <CommitInput
        label="Name"
        value={t.name}
        onCommit={(v) => update({ name: v.trim() || t.name })}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          Side
          <select
            aria-label="Side"
            className={inputClass}
            value={t.side}
            onChange={(e) => update({ side: e.target.value as TokenInfo['side'] })}
          >
            {TOKEN_SIDES.map((s) => (
              <option key={s} value={s}>
                {SIDE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          Size
          <select
            aria-label="Size"
            className={inputClass}
            value={t.size}
            onChange={(e) => update({ size: e.target.value as TokenInfo['size'] })}
          >
            {CREATURE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CommitInput
          label="HP"
          type="number"
          value={hp ? String(hp.current) : ''}
          onCommit={(v) => setHp('current', v)}
        />
        <CommitInput
          label="Max HP"
          type="number"
          value={hp ? String(hp.max) : ''}
          onCommit={(v) => setHp('max', v)}
        />
        <CommitInput
          label="Temp HP"
          type="number"
          value={hp ? String(hp.temp) : ''}
          onCommit={(v) => setHp('temp', v)}
        />
        <CommitInput
          label="AC"
          type="number"
          value={t.ac?.toString() ?? ''}
          onCommit={(v) => update({ ac: parseNum(v) })}
        />
        <CommitInput
          label="Speed (ft)"
          type="number"
          value={t.speed?.toString() ?? ''}
          onCommit={(v) => update({ speed: parseNum(v) })}
        />
        <CommitInput
          label="Init bonus"
          type="number"
          value={t.initiativeBonus?.toString() ?? ''}
          onCommit={(v) => update({ initiativeBonus: parseNum(v) })}
        />
      </div>
      {hp && (
        <div className="flex items-end gap-1">
          <label className="flex flex-1 flex-col gap-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Amount
            <input
              type="number"
              min={1}
              aria-label="Damage or healing amount"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyHp(-1)}
            />
          </label>
          <Button onClick={() => applyHp(-1)} className="text-red-600 dark:text-red-400">
            Damage
          </Button>
          <Button onClick={() => applyHp(1)} className="text-green-700 dark:text-green-400">
            Heal
          </Button>
        </div>
      )}
      <CommitInput
        label="Conditions (comma separated)"
        value={t.conditions.join(', ')}
        onCommit={(v) =>
          update({
            conditions: v
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={t.hidden}
          onChange={(e) => update({ hidden: e.target.checked })}
        />
        Hidden from players (shown faded here)
      </label>
    </div>
  )
}

export function TokenPanel() {
  const selection = useEditorStore((s) => s.selection)
  const doc = useMapStore((s) => s.doc)
  if (selection.layer !== 'tokens' || selection.ids.length !== 1) return null
  const p = doc.props[selection.ids[0]]
  if (!p) return null
  return (
    <Panel title="Token">
      <TokenForm key={p.id} doc={doc} p={p} />
    </Panel>
  )
}
