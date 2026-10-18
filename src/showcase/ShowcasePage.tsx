import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ClipboardList,
  Download,
  Expand,
  Map,
  Pause,
  Play,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Swords,
  Users,
  VolumeX,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import './showcase.css'

const SCENE_MS = 7200

const scenes = [
  {
    eyebrow: 'THE MAP CREATOR',
    title: 'Build a world worth getting lost in.',
    copy: 'Paint rooms, carve corridors, place doors and creatures, then keep every layer editable.',
    points: ['Grid-first map editing', 'Rooms, walls, props and tokens', 'Undo, autosave and keyboard tools'],
    view: 'map',
  },
  {
    eyebrow: 'PROCEDURAL GENERATION',
    title: 'Start with a spark. Make it yours.',
    copy: 'Generate a dungeon, cave, tavern or village from a seed, then revise every detail by hand.',
    points: ['Repeatable seeded layouts', 'Caves, dungeons and settlements', 'One-step undo for generation'],
    view: 'generate',
  },
  {
    eyebrow: 'CREATURES & ENCOUNTERS',
    title: 'Prepare once. Reuse when it matters.',
    copy: 'Keep creature templates and encounter rosters ready, with saved map links and token details.',
    points: ['Creature and NPC templates', 'Save and start encounters fresh', 'Send templates to the map or tracker'],
    view: 'encounters',
  },
  {
    eyebrow: 'MANUAL COMBAT TRACKING',
    title: 'You roll. The tracker keeps the pace.',
    copy: 'Roll at your table or with your preferred roller. Enter the results and see the turn order at a glance.',
    points: ['Enter initiative and battle stats', 'See who acts now and who is next', 'No in-app dice rolls'],
    view: 'combat',
  },
  {
    eyebrow: 'COMBAT TIMELINE',
    title: 'Keep every important moment in view.',
    copy: 'Track movement, HP, conditions and turns. Add a quick note for the action you want to remember.',
    points: ['Movement and combat events', 'Manual action notes by round', 'Undo logged state changes'],
    view: 'timeline',
  },
  {
    eyebrow: 'CAMPAIGN WORKSPACE',
    title: 'Keep the story connected between sessions.',
    copy: 'Bring characters, quests, treasure, session recaps, encounters and map rooms together.',
    points: ['Character stats ready for combat', 'Quests, loot and session threads', 'DM-controlled rest checklist + JSON backup'],
    view: 'campaign',
  },
  {
    eyebrow: 'DM BOARD',
    title: 'Your table tools, all within reach.',
    copy: 'Search your rules and conditions, keep session notes, and arrange the board to suit your flow.',
    points: ['Fast rules and condition lookup', 'Linked notes and map-room references', 'Draggable, resizable cards'],
    view: 'board',
  },
  {
    eyebrow: 'EXPORT & TAKE IT WITH YOU',
    title: 'Make it at home. Run it anywhere.',
    copy: 'Export maps for print or virtual tabletops. Your campaign stays in your browser unless you choose to back it up.',
    points: ['PNG, PDF and map-package export', 'Virtual tabletop export options', 'Offline-first, local storage'],
    view: 'export',
  },
] as const

type SceneView = (typeof scenes)[number]['view']

const layouts = [
  '##########',
  '#..##....#',
  '#........#',
  '#..##....#',
  '##########',
]

function MapPreview({ cave = false }: { cave?: boolean }) {
  const initialMap = cave
    ? ['..####....', '.##..##...', '##....###.', '#..##...##', '.##..##...']
    : layouts
  const [map, setMap] = useState(initialMap)
  return (
    <div className={`show-map ${cave ? 'show-map-cave' : ''}`}>
      <div className="show-map-grid">
        {map.join('').split('').map((cell, index) => (
          <button key={index} type="button" aria-label={`Edit map tile ${index + 1}`} onClick={() => setMap((current) => current.map((row, rowIndex) => rowIndex === Math.floor(index / 10) ? row.slice(0, index % 10) + (row[index % 10] === '#' ? '.' : '#') + row.slice(index % 10 + 1) : row))} className={`show-map-cell ${cell === '#' ? 'show-wall' : 'show-floor'} ${index % 17 === 0 ? 'show-glow' : ''}`} />
        ))}
      </div>
      <span className="show-map-label show-label-one">01 · THE OLD KEEP</span>
      <span className="show-map-label show-label-two">02 · FLOODED HALL</span>
      <span className="show-token show-token-hero">L</span>
      <span className="show-token show-token-foe">G</span>
      <span className="show-ping" />
    </div>
  )
}

function MockWindow({ children, title = 'DM TOOLKIT' }: { children: ReactNode; title?: string }) {
  return (
    <div className="show-window">
      <div className="show-window-bar">
        <div className="flex gap-1.5"><i /><i /><i /></div>
        <span>{title}</span>
        <span className="show-window-status"><span /> LOCAL</span>
      </div>
      {children}
    </div>
  )
}

function MockMap({ generated = false }: { generated?: boolean }) {
  const [generation, setGeneration] = useState(0)
  return (
    <MockWindow title={generated ? 'MAP CREATOR · GENERATOR' : 'MAP CREATOR · THE OLD KEEP'}>
      <div className="show-map-toolbar"><span className="show-tool-active"><Map size={12} /> Map</span><span>Brush</span><span>Wall</span><span>Stamp</span><span>Measure</span><span className="ml-auto">−　100%　+</span></div>
      <div className="show-editor">
        <aside className="show-rail"><span>▦</span><span>◈</span><span>⌁</span><span>♙</span><span>⌖</span></aside>
        <div className="show-canvas"><MapPreview key={generated && generation % 2 === 1 ? 'cave' : 'keep'} cave={generated && generation % 2 === 1} />
          {generated && <div className="show-seed"><Sparkles size={12} /> SEEDED DUNGEON <b>KEEP-{String(42 + generation).padStart(3, '0')}</b></div>}
          {generated && <button type="button" className="show-regenerate" onClick={() => setGeneration((value) => value + 1)}>Generate another map</button>}
        </div>
        <aside className="show-inspector"><b>{generated ? 'GENERATE' : 'LAYERS'}</b>{generated ? <><span>Cave / dungeon</span><span>Seed: KEEP-042</span><button>Generate map</button></> : <><span>☑ Terrain</span><span>☑ Props</span><span>☑ Tokens</span><span>☑ Notes</span><small>Autosaved just now</small></>}</aside>
      </div>
    </MockWindow>
  )
}

function CreaturePreview() {
  return <MockWindow title="DM BOARD · ENCOUNTER PREP"><div className="show-app-columns"><div className="show-mini-card"><div className="show-mini-heading"><Users size={14} /> CREATURE TEMPLATES</div><div className="show-creature"><span className="show-avatar avatar-red">G</span><span><b>Goblin scout</b><small>Enemy · 7 HP · AC 15</small></span><button>+ Initiative</button></div><div className="show-creature"><span className="show-avatar avatar-violet">M</span><span><b>Marsh witch</b><small>Enemy · 38 HP · AC 13</small></span><button>Place</button></div><div className="show-creature"><span className="show-avatar avatar-blue">L</span><span><b>Lantern bearer</b><small>Ally · 18 HP · AC 12</small></span><button>+ Initiative</button></div></div><div className="show-mini-card"><div className="show-mini-heading"><Swords size={14} /> ENCOUNTER LIBRARY</div><div className="show-encounter-feature"><span className="show-sigil"><Swords size={22} /></span><b>Ambush at the old bridge</b><small>4 creatures · map linked</small><button>Start fresh encounter　→</button></div><div className="show-muted-line">Create from your current roster</div></div></div></MockWindow>
}

function StaticCombatPreview() {
  const actors = [
    { name: 'Mira · Ranger', init: '19', hp: '28/28', side: 'blue', active: false },
    { name: 'Goblin scout', init: '16', hp: '7/7', side: 'red', active: true },
    { name: 'Bram · Cleric', init: '12', hp: '34/34', side: 'green', active: false },
    { name: 'Marsh witch', init: '9', hp: '38/38', side: 'violet', active: false },
  ]
  return <MockWindow title="DM BOARD · COMBAT TRACKER"><div className="show-combat-top"><div><small>ROUND</small><strong>03</strong></div><div className="show-next-chip"><span className="show-live-dot" /> UP NEXT <b>Mira · Ranger</b></div><span className="show-external-roll"><Shield size={13} /> YOU ROLL AT THE TABLE</span></div><div className="show-initiative-list">{actors.map((actor) => <div key={actor.name} className={`show-actor ${actor.active ? 'show-actor-active' : ''}`}><b className="show-init">{actor.init}</b><span className={`show-avatar avatar-${actor.side}`}>{actor.name[0]}</span><span className="show-actor-name">{actor.name}</span><span className="show-hp">♥ {actor.hp}</span>{actor.active && <b className="show-turn-now">ACTING</b>}</div>)}</div><div className="show-combat-footer"><span>Enter initiative, damage &amp; save results manually.</span><button>End turn　→</button></div></MockWindow>
}

function CombatPreview() {
  const order = ['Mira · Ranger', 'Goblin scout', 'Bram · Cleric', 'Marsh witch']
  const [active, setActive] = useState(1)
  const [hp, setHp] = useState([28, 7, 34, 38])
  const [round, setRound] = useState(3)
  const [lastAction, setLastAction] = useState('Goblin scout is acting. Use the controls to advance the encounter.')
  const advance = () => {
    const next = (active + 1) % order.length
    setActive(next)
    if (next === 0) setRound((value) => value + 1)
    setLastAction(`${order[next]} is up next.`)
  }
  const damage = () => {
    const target = (active + 1) % order.length
    setHp((current) => current.map((value, index) => index === target ? Math.max(0, value - 5) : value))
    setLastAction(`${order[target]} takes 5 damage. HP updates in the tracker.`)
  }
  return <div className="show-live-demo"><StaticCombatPreview /><div className="show-live-controls"><span aria-live="polite"><b>ROUND {round}</b> · {lastAction}</span><button type="button" onClick={damage}>Apply 5 damage</button><button type="button" onClick={advance}>Next turn →</button><div className="show-live-roster">{order.map((name, index) => <span key={name} className={index === active ? 'is-active' : ''}>{name} <b>{hp[index]} HP</b></span>)}</div></div></div>
}

function TimelinePreview() {
  return <MockWindow title="DM BOARD · COMBAT LOG"><div className="show-timeline-head"><div><small>ROUND</small><strong>03</strong></div><span className="show-next-chip">NEXT <b>Bram · Cleric</b></span></div><div className="show-log-list"><div><span>R3</span><p><b>Goblin scout</b> moves 20 ft</p><Check size={14} /></div><div><span>R3</span><p><b>Mira · Ranger:</b> takes cover behind the fallen pillar</p><Check size={14} /></div><div><span>R3</span><p><b>Mira · Ranger</b> takes 8 damage (20/28)</p><Check size={14} /></div><div><span>R2</span><p><b>Bram · Cleric</b> is concentrating · DC 10</p><Check size={14} /></div></div><div className="show-note-entry"><ClipboardList size={13} /> Record a move or action… <button>Add to log</button></div></MockWindow>
}

function StaticCampaignPreview() {
  return <MockWindow title="DM BOARD · CAMPAIGN"><div className="show-tabs"><b>Sessions</b><span>Characters</span><span>Quests</span><span>Loot</span><span className="show-backup"><Download size={12} /> JSON backup</span></div><div className="show-campaign-grid"><div className="show-session-card"><small>SESSION 08 · OCT 17</small><h3>The Bell Beneath Blackwater</h3><p>The party found the sealed stair beneath the flooded hall. The witch escaped with the brass key.</p><div className="show-link-row"><span>↗ Room 02 · Flooded hall</span><span>↗ Marsh witch</span></div></div><div className="show-character-stack"><div className="show-character-title"><Users size={13} /> PARTY CHARACTERS</div><div><b>Mira</b><span>Ranger · Lv 4</span><em>28 HP</em></div><div><b>Bram</b><span>Cleric · Lv 4</span><em>34 HP</em></div><div className="show-quest-pill">ACTIVE QUEST <b>Find the bell's keeper</b></div></div></div><div className="show-backup-foot"><Check size={12} /> Saved locally in this browser <span>·</span> Export or import campaign JSON</div></MockWindow>
}

function CampaignPreview() {
  const [name, setName] = useState('Mira')
  const [className, setClassName] = useState('Ranger')
  const [saved, setSaved] = useState(false)
  return <div className="show-live-demo"><StaticCampaignPreview /><form className="show-player-sheet-demo" onSubmit={(event) => { event.preventDefault(); setSaved(true) }}><div><Users size={13} /><b>PLAYER SHEET · TRY IT</b><span>Edits stay in this demo.</span></div><label>Character name<input value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} /></label><label>Class / subclass<input value={className} onChange={(event) => { setClassName(event.target.value); setSaved(false) }} /></label><button type="submit">Save player sheet</button>{saved && <strong role="status">Saved: {name} · {className}</strong>}</form></div>
}

function BoardPreview() {
  return <MockWindow title="DM BOARD · SESSION DESK"><div className="show-board-grid"><div className="show-board-tile show-board-notes"><div><ClipboardList size={14} /> SESSION NOTES</div><b>The bell rings at low tide.</b><p>Three knocks from below the flooded hall. The old keeper knows the answer.</p><span>↗ Room 02 · Flooded hall</span></div><div className="show-board-tile show-board-search"><div><Search size={14} /> QUICK RULE SEARCH</div><div className="show-search-result"><b>Grappled</b><small>Speed 0 · Escape with an action</small></div><div className="show-search-result"><b>Prone</b><small>Attack rolls within 5 ft have advantage</small></div></div><div className="show-board-tile show-board-tools"><div><BookOpen size={14} /> TABLE TOOLS</div><span>Travel pace　<b>Normal</b></span><span>Typical DC　<b>15 · Hard</b></span><span>Round tracker　<b>03</b></span></div></div></MockWindow>
}

function ExportPreview() {
  return <MockWindow title="MAP CREATOR · EXPORT"><div className="show-export-layout"><MapPreview /><div className="show-export-options"><div className="show-mini-heading"><Download size={14} /> READY TO EXPORT</div><div className="show-export-row"><span className="show-export-icon">PNG</span><span><b>Virtual tabletop image</b><small>Grid-aligned · high resolution</small></span><Check size={14} /></div><div className="show-export-row"><span className="show-export-icon icon-pdf">PDF</span><span><b>Print-ready map</b><small>Scale bar included</small></span><Check size={14} /></div><div className="show-export-row"><span className="show-export-icon icon-json">{`{ }`}</span><span><b>Map package</b><small>Editable project backup</small></span><Check size={14} /></div><div className="show-offline"><Shield size={13} /> YOUR MAPS STAY IN YOUR BROWSER</div></div></div></MockWindow>
}

function ScenePreview({ view }: { view: SceneView }) {
  if (view === 'map') return <MockMap />
  if (view === 'generate') return <MockMap generated />
  if (view === 'encounters') return <CreaturePreview />
  if (view === 'combat') return <CombatPreview />
  if (view === 'timeline') return <TimelinePreview />
  if (view === 'campaign') return <CampaignPreview />
  if (view === 'board') return <BoardPreview />
  return <ExportPreview />
}

export default function ShowcasePage() {
  const navigate = useNavigate()
  const [sceneIndex, setSceneIndex] = useState(0)
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [elapsed, setElapsed] = useState(0)
  const stageRef = useRef<HTMLElement>(null)
  const scene = scenes[sceneIndex]
  const totalMs = SCENE_MS * scenes.length
  const currentMs = sceneIndex * SCENE_MS + elapsed
  const progress = (currentMs / totalMs) * 100

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setElapsed((value) => value + 100), 100)
    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    if (elapsed < SCENE_MS) return
    setElapsed(0)
    setSceneIndex((index) => (index + 1) % scenes.length)
  }, [elapsed])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return
      if (event.code === 'Space') {
        event.preventDefault()
        setPlaying((value) => !value)
      } else if (event.key === 'ArrowRight') {
        setSceneIndex((index) => (index + 1) % scenes.length)
        setElapsed(0)
      } else if (event.key === 'ArrowLeft') {
        setSceneIndex((index) => (index - 1 + scenes.length) % scenes.length)
        setElapsed(0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const goTo = (index: number) => {
    setSceneIndex((index + scenes.length) % scenes.length)
    setElapsed(0)
  }

  const toggleFullscreen = async () => {
    if (!stageRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await stageRef.current.requestFullscreen()
  }

  return (
    <main className="showcase-page">
      <section className="showcase-shell" ref={stageRef} aria-label="DM Toolkit video showcase">
        <div className="showcase-atmosphere" />
        <div className="showcase-topline"><span className="showcase-brand"><span className="showcase-brand-mark"><Sparkles size={15} /></span> DM TOOLKIT</span><span className="showcase-running"><span /> PRODUCT TOUR · 58 SEC</span><span className="showcase-sound"><VolumeX size={13} /> NO AUDIO</span></div>
        <div className="showcase-content" key={sceneIndex}>
          <div className="showcase-copy">
            <p className="showcase-eyebrow"><span /> {scene.eyebrow}</p>
            <h1>{scene.title}</h1>
            <p className="showcase-description">{scene.copy}</p>
            <ul>{scene.points.map((point) => <li key={point}><Check size={14} /> {point}</li>)}</ul>
            <div className="showcase-actions"><button type="button" onClick={() => navigate(scene.view === 'map' || scene.view === 'generate' || scene.view === 'export' ? '/map' : '/board')}>Open live {scene.view === 'map' || scene.view === 'generate' || scene.view === 'export' ? 'Map Creator' : 'DM Board'} <ArrowUpRight size={14} /></button><a href="/dm-toolkit-showcase.mp4" download>Download video <Download size={13} /></a></div>
            <div className="showcase-scene-count">SCENE {String(sceneIndex + 1).padStart(2, '0')} <span>/</span> {String(scenes.length).padStart(2, '0')}</div>
          </div>
          <div className="showcase-preview-wrap"><ScenePreview view={scene.view} /></div>
        </div>
        <div className="showcase-controls">
          <button className="showcase-play" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause showcase' : 'Play showcase'}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
          <button type="button" onClick={() => goTo(sceneIndex - 1)} aria-label="Previous scene"><ArrowLeft size={17} /></button>
          <button type="button" onClick={() => goTo(sceneIndex + 1)} aria-label="Next scene"><ArrowRight size={17} /></button>
          <span className="showcase-time">{String(Math.floor((sceneIndex * SCENE_MS + elapsed) / 1000)).padStart(2, '0')}<i> / 58</i></span>
          <input aria-label="Showcase timeline" type="range" min={0} max={totalMs - 1} value={currentMs} onChange={(event) => { const seek = event.target.valueAsNumber; setSceneIndex(Math.floor(seek / SCENE_MS)); setElapsed(seek % SCENE_MS) }} style={{ '--seek-progress': `${progress}%` } as CSSProperties & { '--seek-progress': string }} />
          <button type="button" onClick={() => { setSceneIndex(0); setElapsed(0); setPlaying(true) }} aria-label="Restart showcase"><RotateCcw size={15} /></button>
          <button type="button" onClick={() => void toggleFullscreen()} aria-label="Toggle fullscreen"><Expand size={15} /></button>
        </div>
        <div className="showcase-caption"><span>{sceneIndex + 1} — {scene.eyebrow}</span><span>SPACE pause · ← → skip</span></div>
      </section>
      <p className="showcase-footnote">Interactive sample data stays in this demo. Download the MP4 to share the tour, or open any feature in the live toolkit.</p>
    </main>
  )
}
