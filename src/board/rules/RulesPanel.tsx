import { Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { inputClass } from '../../app/ui'
import { useBoardUi } from '../ui/uiStore'
import { useRulesStore } from './store'
import { RULE_CATEGORIES } from './types'

function PackManager() {
  const packs = useRulesStore((s) => s.packs)
  const sampleEnabled = useRulesStore((s) => s.sampleEnabled)
  const setSampleEnabled = useRulesStore((s) => s.setSampleEnabled)
  const importPack = useRulesStore((s) => s.importPack)
  const removePack = useRulesStore((s) => s.removePack)
  const [report, setReport] = useState<{ ok: string | null; errors: string[] }>({
    ok: null,
    errors: [],
  })

  const onFile = async (file: File) => {
    let json: unknown
    try {
      json = JSON.parse(await file.text())
    } catch (e) {
      setReport({ ok: null, errors: [`${file.name} is not valid JSON: ${(e as Error).message}`] })
      return
    }
    const v = await importPack(json, file.name.replace(/\.json$/i, ''))
    setReport({
      ok: v.entries.length ? `Imported ${v.entries.length} entries from ${file.name}.` : null,
      errors: v.entries.length ? v.errors : ['No valid entries were found.', ...v.errors],
    })
  }

  return (
    <details className="mb-2 rounded-md border border-zinc-200 text-xs dark:border-zinc-700">
      <summary className="cursor-pointer px-2 py-1 font-medium">
        Rules content ({packs.filter((p) => p.origin !== 'sample').length} added)
      </summary>
      <div className="flex flex-col gap-1.5 p-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sampleEnabled}
            onChange={(e) => setSampleEnabled(e.target.checked)}
          />
          Show the built-in sample rules (original placeholders, not official text)
        </label>
        {packs
          .filter((p) => p.origin !== 'sample')
          .map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <span>
                {p.name} · {p.entries.length} entries{' '}
                <span className="text-zinc-500">
                  ({p.origin === 'bundled' ? 'bundled from src/data/srd' : 'imported'})
                </span>
              </span>
              {p.origin === 'imported' && (
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => window.confirm(`Remove "${p.name}"?`) && void removePack(p.id)}
                  className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Trash2 size={12} aria-hidden />
                </button>
              )}
            </div>
          ))}
        <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded border border-zinc-300 px-2 py-0.5 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800">
          <Upload size={12} aria-hidden /> Import rules JSON…
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Rules JSON file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </label>
        <p className="text-zinc-500">
          Use SRD 5.1 content (CC-BY-4.0) or text you own for personal use. Imported content stays
          in this browser and is never bundled into the app. The format is described in the README.
        </p>
        {report.ok && <p className="text-green-700 dark:text-green-400">{report.ok}</p>}
        {report.errors.length > 0 && (
          <ul role="alert" className="list-disc pl-4 text-red-700 dark:text-red-400">
            {report.errors.slice(0, 10).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {report.errors.length > 10 && <li>…and {report.errors.length - 10} more</li>}
          </ul>
        )}
      </div>
    </details>
  )
}

export function RulesPanel() {
  const docs = useRulesStore((s) => s.docs)
  const load = useRulesStore((s) => s.load)
  const openEntry = useBoardUi((s) => s.openEntry)
  const [category, setCategory] = useState<string>('combat')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    void load()
  }, [load])

  const list = useMemo(
    () =>
      docs
        .filter(
          (d) =>
            d.category === category &&
            (!filter || d.title.toLowerCase().includes(filter.toLowerCase())),
        )
        .sort((a, b) => a.title.localeCompare(b.title)),
    [docs, category, filter],
  )

  return (
    <div className="flex h-full flex-col text-sm">
      <PackManager />
      <div className="mb-1.5 flex gap-1">
        <select
          aria-label="Rules category"
          className={`${inputClass} w-auto text-xs capitalize`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {RULE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c} ({docs.filter((d) => d.category === c).length})
            </option>
          ))}
        </select>
        <input
          aria-label="Filter rules"
          placeholder="Filter titles"
          className={`${inputClass} text-xs`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <ul aria-label="Rules" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {list.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => openEntry(d.id)}
              className="w-full rounded px-1.5 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="font-medium">{d.title}</span>
              <span className="block text-xs text-zinc-500">{d.summary}</span>
            </button>
          </li>
        ))}
        {!list.length && (
          <li className="p-2 text-xs text-zinc-500">Nothing in this category yet.</li>
        )}
      </ul>
    </div>
  )
}
