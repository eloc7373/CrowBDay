import { useState } from 'react'
import { inputClass } from '../../app/ui'
import { DC_TABLE, PACES, travel, type Pace } from './travel'

export function QuickTools() {
  const [pace, setPace] = useState<Pace>('normal')
  const [hours, setHours] = useState(8)
  const [difficult, setDifficult] = useState(false)
  const [distance, setDistance] = useState('')
  const r = travel(pace, hours, difficult, Number(distance) || undefined)

  return (
    <div className="flex flex-col gap-3 text-sm">
      <section aria-label="Travel pace calculator">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Travel pace
        </h3>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <label className="flex flex-col">
            Pace
            <select
              aria-label="Pace"
              className={inputClass}
              value={pace}
              onChange={(e) => setPace(e.target.value as Pace)}
            >
              {(Object.keys(PACES) as Pace[]).map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            Hours per day
            <input
              aria-label="Hours per day"
              type="number"
              min={1}
              max={24}
              className={inputClass}
              value={hours}
              onChange={(e) => setHours(Math.min(24, Math.max(0, e.target.valueAsNumber || 0)))}
            />
          </label>
          <label className="flex flex-col">
            Distance (miles, optional)
            <input
              aria-label="Distance in miles"
              inputMode="decimal"
              className={inputClass}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1.5 self-end pb-1">
            <input
              type="checkbox"
              checked={difficult}
              onChange={(e) => setDifficult(e.target.checked)}
            />
            Difficult terrain (half)
          </label>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs" data-testid="travel-result">
          <dt className="text-zinc-500">Per minute</dt>
          <dd>{r.feetPerMinute} ft</dd>
          <dt className="text-zinc-500">Per hour</dt>
          <dd>{r.milesPerHour} miles</dd>
          <dt className="text-zinc-500">Per day</dt>
          <dd className="font-semibold">{r.milesPerDay} miles</dd>
          {r.days !== null && (
            <>
              <dt className="text-zinc-500">Journey</dt>
              <dd className="font-semibold">{r.days} days</dd>
            </>
          )}
          <dt className="text-zinc-500">Effect</dt>
          <dd>{PACES[pace].effect}</dd>
        </dl>
        {r.forcedMarchDc !== null && (
          <p
            className="mt-1 rounded bg-orange-100 p-1.5 text-xs text-orange-900 dark:bg-orange-950 dark:text-orange-200"
            role="status"
          >
            Forced march: {r.forcedMarchHours} hour{r.forcedMarchHours > 1 ? 's' : ''} past 8. Each
            extra hour, every traveller makes a Constitution save (DC 10 + 1 per extra hour, up to
            DC {r.forcedMarchDc}) or gains a level of exhaustion.
          </p>
        )}
      </section>
      <section aria-label="DC reference">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Typical DCs
        </h3>
        <table className="w-full text-xs">
          <tbody>
            {DC_TABLE.map((d) => (
              <tr key={d.dc} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-0.5">{d.label}</td>
                <td className="py-0.5 text-right font-mono font-semibold">{d.dc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-[11px] text-zinc-500 italic">
        Values summarise the 2014 Player's Handbook tables.
      </p>
    </div>
  )
}
