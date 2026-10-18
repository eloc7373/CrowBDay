import { LayoutGrid, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  Responsive,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Button } from '../../app/ui'
import { AreaEffect, CombatLog } from '../../combat/ui/CombatPieces'
import { CampaignPanel } from '../dm/CampaignPanel'
import { CompendiumPanel } from '../compendium/CompendiumPanel'
import { CreatureTemplatesPanel } from '../dm/CreatureTemplatesPanel'
import { EncountersPanel } from '../dm/EncountersPanel'
import { RestPanel } from '../dm/RestPanel'
import { ConditionsPanel } from '../conditions/ConditionsPanel'
import { sortedCombatants } from '../initiative/model'
import { InitiativeActions, InitiativePanel } from '../initiative/InitiativePanel'
import { flushCombat, useCombatStore } from '../initiative/store'
import { NotesPanel, NotesStatus } from '../notes/NotesPanel'
import { RulesPanel } from '../rules/RulesPanel'
import { useRulesStore } from '../rules/store'
import { QuickTools } from '../tools/QuickTools'
import { Card } from './Card'
import { useBoardUi } from './uiStore'

type CardId = 'initiative' | 'conditions' | 'dice' | 'notes' | 'rules' | 'tools' | 'area' | 'log' | 'creatures' | 'encounters' | 'campaign' | 'rest' | 'compendium'

const LAYOUT_KEY = 'dmtk.boardLayout.v3'
const BREAKPOINTS = { lg: 1200, md: 900, sm: 0 }
const COLS = { lg: 12, md: 10, sm: 6 }

const DEFAULT_LAYOUTS: ResponsiveLayouts<keyof typeof COLS> = {
  lg: [
    { i: 'initiative', x: 0, y: 0, w: 5, h: 14, minW: 3, minH: 6 },
    { i: 'conditions', x: 5, y: 0, w: 4, h: 14, minW: 3, minH: 6 },
    { i: 'dice', x: 9, y: 0, w: 3, h: 10, minW: 2, minH: 6 },
    { i: 'tools', x: 9, y: 10, w: 3, h: 16, minW: 2, minH: 6 },
    { i: 'notes', x: 0, y: 14, w: 6, h: 12, minW: 3, minH: 6 },
    { i: 'rules', x: 6, y: 14, w: 3, h: 12, minW: 2, minH: 6 },
    { i: 'area', x: 0, y: 26, w: 5, h: 14, minW: 3, minH: 6 },
    { i: 'log', x: 5, y: 26, w: 4, h: 14, minW: 2, minH: 6 },
    { i: 'creatures', x: 0, y: 40, w: 4, h: 16, minW: 3, minH: 6 },
    { i: 'encounters', x: 4, y: 40, w: 4, h: 16, minW: 3, minH: 6 },
    { i: 'rest', x: 8, y: 40, w: 4, h: 16, minW: 3, minH: 6 },
    { i: 'campaign', x: 0, y: 56, w: 8, h: 20, minW: 4, minH: 8 },
    { i: 'compendium', x: 4, y: 76, w: 8, h: 18, minW: 4, minH: 8 },
  ],
  md: [
    { i: 'initiative', x: 0, y: 0, w: 5, h: 14, minW: 3, minH: 6 },
    { i: 'conditions', x: 5, y: 0, w: 5, h: 14, minW: 3, minH: 6 },
    { i: 'dice', x: 0, y: 14, w: 4, h: 10, minW: 2, minH: 6 },
    { i: 'tools', x: 4, y: 14, w: 6, h: 10, minW: 2, minH: 6 },
    { i: 'notes', x: 0, y: 24, w: 6, h: 12, minW: 3, minH: 6 },
    { i: 'rules', x: 6, y: 24, w: 4, h: 12, minW: 2, minH: 6 },
    { i: 'area', x: 0, y: 36, w: 5, h: 14, minW: 3, minH: 6 },
    { i: 'log', x: 5, y: 36, w: 5, h: 14, minW: 2, minH: 6 },
    { i: 'creatures', x: 0, y: 50, w: 5, h: 16, minW: 3, minH: 6 },
    { i: 'encounters', x: 5, y: 50, w: 5, h: 16, minW: 3, minH: 6 },
    { i: 'rest', x: 0, y: 66, w: 5, h: 16, minW: 3, minH: 6 },
    { i: 'campaign', x: 5, y: 66, w: 5, h: 20, minW: 3, minH: 8 },
    { i: 'compendium', x: 0, y: 86, w: 10, h: 18, minW: 4, minH: 8 },
  ],
  sm: [
    { i: 'initiative', x: 0, y: 0, w: 6, h: 14 },
    { i: 'conditions', x: 0, y: 14, w: 6, h: 14 },
    { i: 'dice', x: 0, y: 28, w: 6, h: 10 },
    { i: 'notes', x: 0, y: 38, w: 6, h: 12 },
    { i: 'rules', x: 0, y: 50, w: 6, h: 12 },
    { i: 'tools', x: 0, y: 62, w: 6, h: 14 },
    { i: 'area', x: 0, y: 76, w: 6, h: 14 },
    { i: 'log', x: 0, y: 90, w: 6, h: 12 },
    { i: 'creatures', x: 0, y: 102, w: 6, h: 16 },
    { i: 'encounters', x: 0, y: 118, w: 6, h: 16 },
    { i: 'rest', x: 0, y: 134, w: 6, h: 16 },
    { i: 'campaign', x: 0, y: 150, w: 6, h: 22 },
    { i: 'compendium', x: 0, y: 172, w: 6, h: 20 },
  ],
}

function loadLayouts(): ResponsiveLayouts<keyof typeof COLS> {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? 'null')
    if (saved && typeof saved === 'object') return saved
  } catch {
    // Fall back to the default layout.
  }
  return DEFAULT_LAYOUTS
}

function BoardAreaEffect() {
  const combatants = useCombatStore((s) => s.state.combatants)
  return (
    <div className="overflow-y-auto">
      <AreaEffect
        candidates={sortedCombatants(combatants)}
        emptyHint="Add creatures to the initiative tracker to damage them together."
      />
    </div>
  )
}

function ManualRollsNotice() {
  return <p className="text-sm text-zinc-600 dark:text-zinc-300">Roll dice at the table or with your preferred external roller. Enter initiative, damage, and save results here; this toolkit does not roll for combat.</p>
}

const CARDS: Record<CardId, { title: string; body: ReactNode; actions?: ReactNode }> = {
  initiative: { title: 'Combat tracker', body: <InitiativePanel />, actions: <InitiativeActions /> },
  conditions: { title: 'Conditions', body: <ConditionsPanel /> },
  dice: { title: 'Rolling stays at the table', body: <ManualRollsNotice /> },
  notes: { title: 'Session notes', body: <NotesPanel />, actions: <NotesStatus /> },
  rules: { title: 'Rules', body: <RulesPanel /> },
  tools: { title: 'Quick tools', body: <QuickTools /> },
  area: { title: 'Area damage and saves', body: <BoardAreaEffect /> },
  log: { title: 'Combat log', body: <CombatLog /> },
  creatures: { title: 'Creature templates', body: <CreatureTemplatesPanel /> },
  encounters: { title: 'Encounter library', body: <EncountersPanel /> },
  campaign: { title: 'Campaign', body: <CampaignPanel /> },
  rest: { title: 'Rest recovery', body: <RestPanel /> },
  compendium: { title: 'Monster & player options', body: <CompendiumPanel /> },
}

export default function BoardPage() {
  const { width, containerRef, mounted } = useContainerWidth()
  const [layouts, setLayouts] = useState(loadLayouts)
  const openSearch = useBoardUi((s) => s.openSearch)
  const loadCombat = useCombatStore((s) => s.load)
  const loadRules = useRulesStore((s) => s.load)

  useEffect(() => {
    void loadCombat()
    void loadRules()
    const flush = () => void flushCombat()
    window.addEventListener('pagehide', flush)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
    }
  }, [loadCombat, loadRules])

  const saveLayouts = (_: Layout, all: ResponsiveLayouts<keyof typeof COLS>) => {
    setLayouts(all)
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(all))
    } catch {
      // Layout just won't persist.
    }
  }

  return (
    <div className="flex h-full flex-col bg-zinc-100 dark:bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full max-w-xl items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-left text-sm text-zinc-500 hover:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
          aria-label="Search rules, conditions and spells"
        >
          <Search size={15} aria-hidden />
          <span className="flex-1">Search rules, conditions, spells…</span>
          <kbd className="rounded border border-zinc-300 px-1 font-mono text-[10px] dark:border-zinc-600">
            Ctrl K
          </kbd>
          <kbd className="rounded border border-zinc-300 px-1 font-mono text-[10px] dark:border-zinc-600">
            /
          </kbd>
        </button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          onClick={() => {
            setLayouts(DEFAULT_LAYOUTS)
            try {
              localStorage.removeItem(LAYOUT_KEY)
            } catch {
              // ignore
            }
          }}
          title="Reset card layout"
        >
          <LayoutGrid size={15} aria-hidden /> Reset layout
        </Button>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto" data-testid="board">
        {mounted && (
          <Responsive
            width={width}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            layouts={layouts}
            rowHeight={30}
            margin={[10, 10]}
            containerPadding={[10, 10]}
            dragConfig={{ handle: '.card-handle' }}
            onLayoutChange={saveLayouts}
          >
            {(Object.keys(CARDS) as CardId[]).map((id) => (
              <div key={id} data-card={id}>
                <Card title={CARDS[id].title} actions={CARDS[id].actions} testId={`card-${id}`}>
                  {CARDS[id].body}
                </Card>
              </div>
            ))}
          </Responsive>
        )}
      </div>
    </div>
  )
}
