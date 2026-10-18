import { BookOpen, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, inputClass } from '../../app/ui'
import { addCombatant } from '../initiative/model'
import { useCombatStore } from '../initiative/store'
import { useCompendiumStore } from './store'

export function CompendiumPanel() {
  const packs = useCompendiumStore((state) => state.packs)
  const load = useCompendiumStore((state) => state.load)
  const importPack = useCompendiumStore((state) => state.importPack)
  const removePack = useCompendiumStore((state) => state.removePack)
  const updateCombat = useCombatStore((state) => state.update)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | 'monsters' | 'options'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [report, setReport] = useState('')
  const [zoom, setZoom] = useState<{ urls: string[]; name: string } | null>(null)

  useEffect(() => { void load() }, [load])

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const monsters = kind === 'options' ? [] : packs.flatMap((pack) => pack.monsters.map((entry) => ({ ...entry, entryKind: 'monster' as const, pack: pack.name })))
    const options = kind === 'monsters' ? [] : packs.flatMap((pack) => pack.options.map((entry) => ({ ...entry, entryKind: 'option' as const, pack: pack.name })))
    return [...monsters, ...options].filter((entry) => {
      const searchable = entry.entryKind === 'monster'
        ? `${entry.name} ${entry.pack} ${entry.type ?? ''} ${entry.summary ?? ''} ${entry.traits?.join(' ') ?? ''}`
        : `${entry.name} ${entry.pack} ${entry.category} ${entry.summary} ${entry.description}`
      return !needle || searchable.toLowerCase().includes(needle)
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [kind, packs, query])
  const active = entries.find((entry) => entry.id === selected)

  const onFile = async (file: File) => {
    try {
      const result = await importPack(JSON.parse(await file.text()), file.name.replace(/\.json$/i, ''))
      const count = result.monsters.length + result.options.length
      setReport(count ? `Added ${result.monsters.length} monsters and ${result.options.length} player options from ${file.name}.` : `Nothing imported from ${file.name}. ${result.errors.slice(0, 2).join(' ')}`)
    } catch (error) { setReport(`Could not read ${file.name}: ${(error as Error).message}`) }
  }

  const addMonster = (monster: (typeof entries)[number]) => {
    if (monster.entryKind !== 'monster') return
    updateCombat((state) => addCombatant(state, {
      id: `cbt-${crypto.randomUUID()}`, name: monster.name, initiative: null,
      dexMod: monster.dexMod, initiativeBonus: monster.initiativeBonus, hp: { current: monster.hp, max: monster.hp, temp: 0 },
      ac: monster.ac, conditions: [], exhaustion: 0, side: 'enemy',
      speed: Number.parseInt(monster.speed ?? '', 10) || null, conMod: monster.conMod,
    }))
    setReport(`${monster.name} added to initiative.`)
  }

  const copyOption = async (entry: (typeof entries)[number]) => {
    if (entry.entryKind !== 'option') return
    await navigator.clipboard.writeText(`${entry.name}\n${entry.description}`)
    setReport(`${entry.name} copied. Paste it into the character sheet's Features & traits field.`)
  }

  return <div className="flex h-full flex-col gap-2 text-xs">
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="flex flex-1 items-center gap-1 rounded border border-zinc-300 px-2 dark:border-zinc-600"><BookOpen size={13} aria-hidden /><input className="min-w-0 flex-1 bg-transparent py-1 outline-none" placeholder="Search monsters, feats, traits…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search compendium" /></label>
      <select className={`${inputClass} w-auto`} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} aria-label="Compendium type"><option value="all">Everything</option><option value="monsters">Monsters</option><option value="options">Player options</option></select>
      <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"><Upload size={13} aria-hidden /> Import JSON<input type="file" accept=".json,application/json" className="sr-only" aria-label="Import compendium JSON" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onFile(file); event.target.value = '' }} /></label>
    </div>
    <p className="text-zinc-500">Your imported entries stay in this browser. Search names, types, traits, or descriptions.</p>
    {packs.filter((pack) => pack.notice).map((pack) => <p key={pack.id} className="rounded bg-amber-50 px-2 py-1 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">{pack.notice}</p>)}
    {report && <p role="status" className="text-green-700 dark:text-green-400">{report}</p>}
    {packs.length > 0 && <details className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700"><summary className="cursor-pointer">Manage imported packs ({packs.length})</summary><div className="mt-1 space-y-1">{packs.map((pack) => <div className="flex items-center gap-2" key={pack.id}><span className="flex-1">{pack.name} · {pack.monsters.length} monsters · {pack.options.length} options</span><button type="button" aria-label={`Remove ${pack.name}`} className="text-red-600" onClick={() => { if (window.confirm(`Remove ${pack.name}?`)) void removePack(pack.id) }}><Trash2 size={13} /></button></div>)}</div></details>}
    <div className="grid min-h-0 flex-1 gap-2 overflow-hidden md:grid-cols-2">
      <ul className="min-h-0 space-y-0.5 overflow-y-auto" aria-label="Compendium results">
        {entries.map((entry) => <li key={entry.id}><button type="button" onClick={() => setSelected(entry.id)} className={`w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 ${selected === entry.id ? 'bg-amber-100 dark:bg-amber-950' : ''}`}><strong>{entry.name}</strong><span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 capitalize text-zinc-500 dark:bg-zinc-800">{entry.entryKind === 'monster' ? ('type' in entry ? entry.type : '') || 'monster' : ('category' in entry ? entry.category : 'option')}</span><span className="block truncate text-zinc-500">{entry.entryKind === 'monster' ? `AC ${entry.ac} · ${entry.hp} HP · ${entry.pack}` : `${entry.summary} · ${entry.pack}`}</span></button></li>)}
        {!entries.length && <li className="rounded bg-zinc-50 p-3 text-center text-zinc-500 dark:bg-zinc-800/50">{packs.length ? 'No matching entries.' : 'Import a compendium JSON file to add monsters and player options.'}</li>}
      </ul>
      <section className="min-h-0 overflow-y-auto rounded border border-zinc-200 p-3 dark:border-zinc-700" aria-label="Selected entry details">
        {!active ? <p className="text-zinc-500">Select an entry to see its details and actions.</p> : active.entryKind === 'monster' ? <div className="space-y-2">
          {(active.imageUrls?.length ? active.imageUrls : active.imageUrl ? [active.imageUrl] : []).length > 0 && <button type="button" onClick={() => setZoom({ urls: active.imageUrls?.length ? active.imageUrls : [active.imageUrl as string], name: active.name })} className="block w-full rounded border border-zinc-200 p-1 text-left hover:border-amber-500 dark:border-zinc-700" aria-label={`Open ${active.name} book page full size`}><img src={active.imageUrls?.[0] ?? active.imageUrl} alt={`${active.name} stat block page`} className="max-h-64 w-full rounded object-contain" loading="lazy" /><span className="block pt-1 text-center text-zinc-500">Click to read the book page{active.imageUrls && active.imageUrls.length > 1 ? 's' : ''} full size</span></button>}
          <div><h3 className="text-sm font-semibold">{active.name}</h3><p className="text-zinc-500">{[active.size, active.type, active.alignment, active.challenge && `CR ${active.challenge}${active.xp ? ` (XP ${active.xp})` : ''}`, active.source, active.bookPage && `p. ${active.bookPage}`].filter(Boolean).join(' · ')}</p></div>
          <p><b>AC</b> {active.ac} · <b>HP</b> {active.hp}{active.hpFormula && ` (${active.hpFormula})`}{active.initiativeBonus !== undefined && <> · <b>Initiative</b> {active.initiativeBonus >= 0 ? `+${active.initiativeBonus}` : active.initiativeBonus}{active.initiativeScore !== undefined ? ` (${active.initiativeScore})` : ''}</>}{active.speed && <> · <b>Speed</b> {active.speed}</>}</p>
          {active.abilityScores && <p><b>STR</b> {active.abilityScores.str ?? '—'} · <b>DEX</b> {active.abilityScores.dex ?? '—'} · <b>CON</b> {active.abilityScores.con ?? '—'} · <b>INT</b> {active.abilityScores.int ?? '—'} · <b>WIS</b> {active.abilityScores.wis ?? '—'} · <b>CHA</b> {active.abilityScores.cha ?? '—'}</p>}
          {active.summary && <p>{active.summary}</p>}
          {active.gear && <p><b>Gear</b> {active.gear}</p>}
          {([['Saving Throws', active.savingThrows], ['Skills', active.skills], ['Senses', active.senses], ['Languages', active.languages], ['Damage Vulnerabilities', active.damageVulnerabilities], ['Damage Resistances', active.damageResistances], ['Damage Immunities', active.damageImmunities], ['Condition Immunities', active.conditionImmunities], ['Traits', active.traits], ['Actions', active.actions], ['Bonus Actions', active.bonusActions], ['Reactions', active.reactions], ['Legendary Actions', active.legendaryActions]] as const).map(([label, lines]) => lines?.length ? <div key={label}><h4 className="font-semibold">{label}</h4>{lines.map((line) => <p key={line} className="whitespace-pre-wrap">{line}</p>)}</div> : null)}
          {active.sourceUrl && <a href={active.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline dark:text-blue-300">Open source</a>}
          <Button variant="primary" onClick={() => addMonster(active)}><Plus size={13} /> Add to initiative</Button>
        </div> : <div className="space-y-2"><div><h3 className="text-sm font-semibold">{active.name}</h3><p className="capitalize text-zinc-500">{active.category}{active.source ? ` · ${active.source}` : ''}</p></div><p className="font-medium">{active.summary}</p><p className="whitespace-pre-wrap">{active.description}</p><Button onClick={() => void copyOption(active)}>Copy for player sheet</Button></div>}
      </section>
    </div>
    {zoom && <div role="dialog" aria-modal="true" aria-label={`${zoom.name} book page`} className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={() => setZoom(null)}>
      <div className="flex items-center justify-between px-3 py-2 text-white"><span className="text-sm font-semibold">{zoom.name}</span><button type="button" className="rounded bg-white/20 px-2 py-1 text-xs hover:bg-white/30" onClick={() => setZoom(null)}>Close</button></div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto px-3 pb-3" onClick={(event) => event.stopPropagation()}>{zoom.urls.map((url) => <img key={url} src={url} alt={`${zoom.name} book page`} className="mx-auto w-full max-w-4xl rounded bg-white" />)}</div>
    </div>}
    <details className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700"><summary className="cursor-pointer">JSON format</summary><pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[10px] text-zinc-500">{`{\n  "name": "My personal compendium",\n  "monsters": [{ "name": "Example", "ac": 12, "hp": 7, "dexMod": 2, "type": "beast", "traits": ["Your notes or reference"] }],\n  "options": [{ "name": "Example feature", "category": "feat", "summary": "Short reminder", "description": "Your personal notes or reference", "source": "Book, page 1" }]\n}`}</pre></details>
  </div>
}
