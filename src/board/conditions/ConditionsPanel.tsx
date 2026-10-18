import { Info } from 'lucide-react'
import { toggleConditionLogged } from '../../combat/actions'
import { targetId, updateCombatant } from '../initiative/model'
import { useCombatStore } from '../initiative/store'
import { useBoardUi } from '../ui/uiStore'
import { CONDITIONS, CONDITIONS_NOTICE, EXHAUSTION } from './data'

export function ConditionsPanel() {
  const state = useCombatStore((s) => s.state)
  const update = useCombatStore((s) => s.update)
  const openEntry = useBoardUi((s) => s.openEntry)
  const id = targetId(state)
  const target = state.combatants.find((c) => c.id === id) ?? null
  const has = (name: string) =>
    !!target?.conditions.some((c) => c.toLowerCase() === name.toLowerCase())

  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-xs text-zinc-600 dark:text-zinc-400"
        aria-live="polite"
        data-testid="conditions-target"
      >
        {target ? (
          <>
            Click a card to toggle it on{' '}
            <strong className="text-zinc-900 dark:text-zinc-100">{target.name}</strong>. Select a
            creature in the initiative list to change who this applies to.
          </>
        ) : (
          'Add a creature to the initiative tracker (or press Next) to track conditions on it.'
        )}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-1.5">
        {CONDITIONS.map((c) => {
          const on = has(c.name)
          return (
            <div
              key={c.id}
              className={`relative rounded-md border text-left text-xs ${
                on
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/15'
                  : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700'
              }`}
            >
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${c.name}${target ? ` on ${target.name}` : ''}`}
                disabled={!target}
                onClick={() => target && update((s) => toggleConditionLogged(s, target.id, c.name))}
                className="block w-full p-1.5 text-left disabled:cursor-not-allowed"
              >
                <span className="block pr-4 font-semibold">{c.name}</span>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-3.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                  {c.effects.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </button>
              <button
                type="button"
                aria-label={`Details: ${c.name}`}
                onClick={() => openEntry(`conditions/${c.id}`)}
                className="absolute top-1 right-1 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <Info size={12} aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
      <div className="rounded-md border border-zinc-200 p-2 text-xs dark:border-zinc-700">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-semibold">{EXHAUSTION.name}</span>
          <div role="radiogroup" aria-label="Exhaustion level" className="flex gap-0.5">
            {[0, 1, 2, 3, 4, 5, 6].map((lvl) => (
              <button
                key={lvl}
                type="button"
                role="radio"
                aria-checked={(target?.exhaustion ?? 0) === lvl}
                aria-label={`Exhaustion level ${lvl}`}
                disabled={!target}
                onClick={() =>
                  target && update((s) => updateCombatant(s, target.id, { exhaustion: lvl }))
                }
                className={`h-6 w-6 rounded border text-[11px] disabled:opacity-40 ${
                  (target?.exhaustion ?? 0) === lvl
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
        <ol className="list-decimal space-y-0.5 pl-4 text-[11px]">
          {EXHAUSTION.levels.map((l, i) => (
            <li
              key={l}
              className={
                target && i < target.exhaustion
                  ? 'font-semibold text-orange-700 dark:text-orange-300'
                  : ''
              }
            >
              {l}
            </li>
          ))}
        </ol>
        <p className="mt-1 text-[11px] text-zinc-500">{EXHAUSTION.recovery}</p>
        <p className="mt-1 text-[11px] text-zinc-500 italic">{EXHAUSTION.note}</p>
      </div>
      <p className="text-[11px] text-zinc-500 italic">{CONDITIONS_NOTICE}</p>
    </div>
  )
}
