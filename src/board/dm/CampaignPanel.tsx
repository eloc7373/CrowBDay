import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, inputClass } from '../../app/ui'
import { db, type SessionNote } from '../../lib/db'
import { newId } from '../../lib/id'
import { listRoomMarkers, type RoomMarkerRef } from '../../mapcreator/store/persistence'
import { PlayerSheetsPanel } from './PlayerSheetsPanel'
import { useCampaignStore } from './store'
import type { CampaignLink, CampaignRecord, CampaignRecordKind, CampaignSession } from './types'

const TABS: { id: CampaignRecordKind | 'sessions'; label: string }[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'party', label: 'Player Sheets' },
  { id: 'quest', label: 'Quests' },
  { id: 'loot', label: 'Loot' },
]

export function CampaignPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('sessions')
  const [rooms, setRooms] = useState<RoomMarkerRef[]>([])
  const [notes, setNotes] = useState<SessionNote[]>([])
  const records = useCampaignStore((s) => s.records)
  const sessions = useCampaignStore((s) => s.sessions)
  const encounters = useCampaignStore((s) => s.encounters)
  const load = useCampaignStore((s) => s.load)
  const saveRecord = useCampaignStore((s) => s.saveRecord)
  const deleteRecord = useCampaignStore((s) => s.deleteRecord)
  const saveSession = useCampaignStore((s) => s.saveSession)
  const deleteSession = useCampaignStore((s) => s.deleteSession)
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [details, setDetails] = useState('')
  const [status, setStatus] = useState('Active')
  const [holder, setHolder] = useState('')
  const [origin, setOrigin] = useState('')
  const [editing, setEditing] = useState<CampaignSession | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [recap, setRecap] = useState('')
  const [decisions, setDecisions] = useState('')
  const [threads, setThreads] = useState('')
  const [links, setLinks] = useState<CampaignLink[]>([])

  useEffect(() => {
    void load()
    if (tab === 'sessions') {
      void listRoomMarkers().then(setRooms).catch(() => setRooms([]))
      void db.sessionNotes.toArray().then(setNotes).catch(() => setNotes([]))
    }
  }, [load, tab])

  const linkOptions = useMemo(() => [
    ...records.map((record) => ({ kind: record.type, id: record.id, label: record.name })),
    ...encounters.map((encounter) => ({ kind: 'encounter' as const, id: encounter.id, label: encounter.name, mapId: encounter.mapId ?? undefined })),
    ...notes.map((note) => ({ kind: 'note' as const, id: note.id, label: note.title })),
    ...rooms.map((room) => ({ kind: 'room' as const, id: room.noteId, label: `${room.mapName} · Room ${room.number}: ${room.text}`, mapId: room.mapId })),
  ], [records, encounters, notes, rooms])

  const addLink = (value: string) => {
    const [kind, id] = value.split(':')
    const option = linkOptions.find((item) => item.kind === kind && item.id === id)
    if (option && !links.some((link) => link.kind === option.kind && link.id === option.id)) {
      setLinks([...links, { kind: option.kind, id: option.id, label: option.label, ...('mapId' in option ? { mapId: option.mapId } : {}) }])
    }
  }

  const saveSessionForm = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    const now = new Date().toISOString()
    void saveSession({
      id: editing?.id ?? newId('session'), date, title: title.trim(), recap, decisions,
      openThreads: threads, links, createdAt: editing?.createdAt ?? now, updatedAt: now,
    })
    setEditing(null); setTitle(''); setRecap(''); setDecisions(''); setThreads(''); setLinks([])
  }

  const beginEdit = (session: CampaignSession) => {
    setEditing(session); setDate(session.date); setTitle(session.title); setRecap(session.recap)
    setDecisions(session.decisions); setThreads(session.openThreads); setLinks(session.links)
  }

  const createRecord = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || tab === 'sessions' || tab === 'party') return
    const record: CampaignRecord = {
      id: newId(tab), type: tab, name: name.trim(), details, status,
      holder, origin, tags: [], updatedAt: new Date().toISOString(),
    }
    void saveRecord(record)
    setName(''); setDetails(''); setHolder(''); setOrigin('')
  }

  const exportBackup = async () => {
    await load()
    const payload = {
      format: 'dm-toolkit-campaign', version: 1,
      creatures: await db.creatureTemplates.toArray(), encounters: await db.encounters.toArray(),
      sessions: await db.campaignSessions.toArray(), records: await db.campaignRecords.toArray(),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'dm-toolkit-campaign.json'; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!data || typeof data !== 'object' || (data as { format?: unknown }).format !== 'dm-toolkit-campaign' || (data as { version?: unknown }).version !== 1) throw new Error('Unsupported backup file')
      const backup = data as Record<string, unknown>
      const collections = ['creatures', 'encounters', 'sessions', 'records'] as const
      if (collections.some((key) => !Array.isArray(backup[key]) || (backup[key] as unknown[]).some((row) => !row || typeof row !== 'object' || typeof (row as { id?: unknown }).id !== 'string'))) throw new Error('Backup is missing valid campaign records')
      if (!window.confirm('Import campaign data? Matching IDs will be replaced; other records are kept.')) return
      await db.transaction('rw', db.creatureTemplates, db.encounters, db.campaignSessions, db.campaignRecords, async () => {
        await db.creatureTemplates.bulkPut(backup.creatures as never[])
        await db.encounters.bulkPut(backup.encounters as never[])
        await db.campaignSessions.bulkPut(backup.sessions as never[])
        await db.campaignRecords.bulkPut(backup.records as never[])
      })
      useCampaignStore.setState({ loaded: false })
      await load()
      window.alert('Campaign data imported.')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import this backup.')
    }
  }

  const openLink = (link: CampaignLink) => {
    if (link.kind === 'room' && link.mapId) navigate(`/map?map=${encodeURIComponent(link.mapId)}&focus=${encodeURIComponent(link.id)}`)
    else if (link.kind === 'encounter' && link.mapId) navigate(`/map?map=${encodeURIComponent(link.mapId)}`)
    else if (link.kind === 'note') navigate('/board')
    else if (link.kind === 'party' || link.kind === 'quest' || link.kind === 'loot') setTab(link.kind)
    else if (link.mapId) navigate(`/map?map=${encodeURIComponent(link.mapId)}`)
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap gap-1">
        {TABS.map((item) => <Button key={item.id} className="!px-2 !py-1 text-xs" variant={tab === item.id ? 'primary' : 'ghost'} onClick={() => setTab(item.id)}>{item.label}</Button>)}
        <span className="flex-1" />
        <Button className="!px-2 !py-1 text-xs" onClick={() => void exportBackup()} title="Export campaign backup"><Download size={13} aria-hidden /> JSON</Button>
        <Button className="!px-2 !py-1 text-xs" onClick={() => fileRef.current?.click()} title="Import campaign backup"><Upload size={13} aria-hidden /> Import</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importBackup(event)} />
      </div>
      {tab === 'sessions' ? <>
        <form onSubmit={saveSessionForm} className="flex flex-col gap-1.5 rounded bg-zinc-50 p-2 dark:bg-zinc-800/50">
          <div className="flex gap-1"><input aria-label="Session date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /><input aria-label="Session title" placeholder="Session title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <textarea aria-label="Session recap" placeholder="Recap" className={inputClass} rows={2} value={recap} onChange={(e) => setRecap(e.target.value)} />
          <textarea aria-label="Session decisions" placeholder="Decisions and consequences" className={inputClass} rows={2} value={decisions} onChange={(e) => setDecisions(e.target.value)} />
          <textarea aria-label="Open threads" placeholder="Open threads / next session hooks" className={inputClass} rows={2} value={threads} onChange={(e) => setThreads(e.target.value)} />
          <div className="flex flex-wrap items-center gap-1"><select aria-label="Link campaign record" className={`${inputClass} w-auto min-w-0 flex-1`} value="" onChange={(e) => addLink(e.target.value)}><option value="">Link a note, room, character, quest, loot, or encounter…</option>{linkOptions.map((option) => <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>{option.kind}: {option.label}</option>)}</select><Button type="submit" variant="primary" className="!px-2 !py-1">{editing ? 'Update session' : 'Add session'}</Button>{editing && <Button className="!px-2 !py-1" onClick={() => { setEditing(null); setTitle(''); setLinks([]) }}>Cancel</Button>}</div>
          {links.length > 0 && <div className="flex flex-wrap gap-1">{links.map((link) => <button type="button" key={`${link.kind}:${link.id}`} className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-900 dark:text-amber-100" onClick={() => setLinks(links.filter((item) => item !== link))}>{link.kind}: {link.label} ×</button>)}</div>}
        </form>
        <div className="flex flex-col gap-1">{sessions.map((session) => <article key={session.id} className="rounded border border-zinc-200 p-2 dark:border-zinc-700"><div className="flex items-center gap-1"><strong className="flex-1">{session.date} · {session.title}</strong><Button className="!p-1" title="Edit session" onClick={() => beginEdit(session)}>Edit</Button><Button className="!p-1 text-red-600" title="Delete session" onClick={() => window.confirm('Delete this session log?') && void deleteSession(session.id)}><Trash2 size={13} /></Button></div>{session.recap && <p className="mt-1 whitespace-pre-wrap">{session.recap}</p>}{session.decisions && <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-300"><b>Decisions:</b> {session.decisions}</p>}{session.openThreads && <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-300"><b>Open threads:</b> {session.openThreads}</p>}{session.links.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{session.links.map((link) => <button type="button" key={`${link.kind}:${link.id}`} className="text-sky-700 underline dark:text-sky-300" onClick={() => openLink(link)}>{link.kind}: {link.label}</button>)}</div>}</article>)}</div>
      </> : tab === 'party' ? <PlayerSheetsPanel /> : <>
        <form onSubmit={createRecord} className="flex flex-col gap-1.5 rounded bg-zinc-50 p-2 dark:bg-zinc-800/50">
          <div className="flex gap-1"><input aria-label={`${tab} name`} placeholder={tab === 'quest' ? 'Quest name' : 'Treasure / item name'} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /><select aria-label="Record status" className={`${inputClass} max-w-28`} value={status} onChange={(e) => setStatus(e.target.value)}>{(tab === 'quest' ? ['Active', 'Completed', 'Failed', 'On hold'] : ['Unclaimed', 'Claimed', 'Sold', 'Spent']).map((value) => <option key={value}>{value}</option>)}</select></div>
          {tab === 'loot' && <input aria-label="Loot holder" placeholder="Holder / who carries it" className={inputClass} value={holder} onChange={(e) => setHolder(e.target.value)} />}
          {tab === 'quest' && <input aria-label="Quest source" placeholder="Quest giver / origin" className={inputClass} value={origin} onChange={(e) => setOrigin(e.target.value)} />}
          <textarea aria-label="Record details" placeholder={tab === 'quest' ? 'Objective, clues, rewards…' : 'Description, quantity, value…'} className={inputClass} rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
          <Button type="submit" variant="primary" className="self-start !px-2 !py-1"><Plus size={13} /> Add {tab}</Button>
        </form>
        <div className="flex flex-col gap-1">{records.filter((record) => record.type === tab).map((record) => <article key={record.id} className="rounded border border-zinc-200 p-2 dark:border-zinc-700"><div className="flex items-center gap-1"><strong className="flex-1">{record.name}</strong><span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{record.status}</span><Button className="!p-1 text-red-600" aria-label={`Delete ${record.name}`} onClick={() => window.confirm(`Delete ${record.name}?`) && void deleteRecord(record.id)}><Trash2 size={13} /></Button></div>{record.details && <p className="mt-1 whitespace-pre-wrap">{record.details}</p>}{(record.holder || record.origin) && <p className="mt-1 text-zinc-500">{record.holder && `Holder: ${record.holder}`}{record.holder && record.origin && ' · '}{record.origin && `From: ${record.origin}`}</p>}</article>)}</div>
      </>}
    </div>
  )
}
