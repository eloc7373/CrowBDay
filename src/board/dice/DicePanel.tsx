import { Dices, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, inputClass } from '../../app/ui'
import { DiceError, roll, type RollMode, type RollResult } from './dice'

const QUICK = ['d20', 'd4', 'd6', 'd8', 'd10', 'd12', 'd100', '2d6', '4d6kh3']
const HISTORY_KEY = 'dmtk.diceHistory'
const MAX_HISTORY = 50

interface Entry {
  id: number
  label: string
  result: RollResult
  at: string
}

function loadHistory(): Entry[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(v) ? v.slice(0, MAX_HISTORY) : []
  } catch {
    return []
  }
}

/** Dice text with dropped dice (~~n~~) struck through. */
function Working({ text }: { text: string }) {
  const parts = text.split(/(~~\d+~~)/)
  return (
    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
      {parts.map((p, i) =>
        p.startsWith('~~') ? (
          <s key={i} className="opacity-60">
            {p.slice(2, -2)}
          </s>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  )
}

export function DicePanel() {
  const [expr, setExpr] = useState('1d20+5')
  const [mode, setMode] = useState<RollMode>('normal')
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Entry[]>(loadHistory)

  const doRoll = (text: string) => {
    try {
      const result = roll(text, mode)
      setError(null)
      const entry: Entry = {
        id: Date.now() + Math.random(),
        label: text,
        result,
        at: new Date().toISOString(),
      }
      const next = [entry, ...history].slice(0, MAX_HISTORY)
      setHistory(next)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // History just won't persist.
      }
    } catch (e) {
      setError(e instanceof DiceError ? e.message : 'Could not roll that.')
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    doRoll(expr)
  }

  const last = history[0]
  return (
    <div className="flex flex-col gap-2 text-sm">
      <form onSubmit={submit} className="flex gap-1">
        <input
          aria-label="Dice expression"
          aria-invalid={!!error}
          aria-describedby={error ? 'dice-error' : undefined}
          className={`${inputClass} font-mono`}
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="e.g. 2d6+3, 4d6kh3"
        />
        <Button type="submit" variant="primary" aria-label="Roll">
          <Dices size={15} aria-hidden /> Roll
        </Button>
      </form>
      {error && (
        <p id="dice-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div
        role="radiogroup"
        aria-label="d20 mode"
        className="flex rounded-md border border-zinc-300 p-0.5 text-xs dark:border-zinc-600"
      >
        {(['disadvantage', 'normal', 'advantage'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded px-1 py-0.5 capitalize ${mode === m ? 'bg-amber-500 text-zinc-950' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
          >
            {m === 'normal' ? 'Normal' : m}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => doRoll(q)}
            className="rounded border border-zinc-300 px-1.5 py-0.5 font-mono text-xs hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {q}
          </button>
        ))}
      </div>
      {last && (
        <div
          className="rounded-md bg-zinc-100 p-2 text-center dark:bg-zinc-800"
          aria-live="polite"
          data-testid="dice-last"
        >
          <div
            className={`text-3xl font-bold ${last.result.natural === 20 ? 'text-green-600' : last.result.natural === 1 ? 'text-red-600' : ''}`}
            data-testid="dice-total"
          >
            {last.result.total}
          </div>
          <Working text={last.result.text} />
          {last.result.natural === 20 && (
            <div className="text-xs font-semibold text-green-600">Natural 20</div>
          )}
          {last.result.natural === 1 && (
            <div className="text-xs font-semibold text-red-600">Natural 1</div>
          )}
          {last.result.mode !== 'normal' && !last.result.modeApplied && (
            <div className="text-xs text-zinc-500">
              ({last.result.mode} only applies to a single d20 roll)
            </div>
          )}
        </div>
      )}
      {history.length > 1 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
            History
            <button
              type="button"
              aria-label="Clear dice history"
              onClick={() => {
                setHistory([])
                try {
                  localStorage.removeItem(HISTORY_KEY)
                } catch {
                  // ignore
                }
              }}
              className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <Trash2 size={12} aria-hidden />
            </button>
          </div>
          <ol aria-label="Roll history" className="space-y-0.5">
            {history.slice(1).map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-2">
                <Working text={h.result.text} />
                <span className="font-semibold">{h.result.total}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
