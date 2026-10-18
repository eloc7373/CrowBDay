// Global search (Ctrl+K or "/") across rules, conditions and spells.

import { Search } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Modal } from '../../app/Modal'
import { useRulesStore } from '../rules/store'
import { useBoardUi } from './uiStore'

const KIND_STYLE = {
  rule: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  spell: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  condition: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
} as const

function Palette() {
  const search = useRulesStore((s) => s.search)
  const openEntry = useBoardUi((s) => s.openEntry)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const results = useMemo(() => search(query, 20), [search, query])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      openEntry(results[active].id)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          size={16}
          className="absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          data-autofocus
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `sr-${active}` : undefined}
          aria-label="Search rules, conditions and spells"
          placeholder="Search rules, conditions, spells… (↑↓ to move, Enter to open)"
          className="w-full rounded-md border border-zinc-300 bg-white py-2 pr-2 pl-8 text-base dark:border-zinc-600 dark:bg-zinc-800"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKey}
        />
      </div>
      <ul
        id="search-results"
        role="listbox"
        aria-label="Search results"
        className="max-h-[55vh] overflow-y-auto"
      >
        {results.map((r, i) => (
          <li
            key={r.id}
            id={`sr-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => openEntry(r.id)}
            className={`cursor-pointer rounded-md px-3 py-2 ${i === active ? 'bg-amber-100 dark:bg-amber-500/15' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">{r.title}</span>
              <span className={`rounded px-1.5 text-[11px] font-medium ${KIND_STYLE[r.kind]}`}>
                {r.kind}
              </span>
              <span className="text-xs text-zinc-500 capitalize">{r.category}</span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{r.summary}</p>
          </li>
        ))}
      </ul>
      {query.trim() && !results.length && (
        <p className="px-3 py-4 text-sm text-zinc-500">No matches for “{query}”.</p>
      )}
      {!query.trim() && (
        <p className="px-1 text-sm text-zinc-500">
          Try “opportunity attack”, “prone”, “fireball” or “long rest”.
        </p>
      )}
    </div>
  )
}

export function SearchPalette() {
  const open = useBoardUi((s) => s.searchOpen)
  const close = useBoardUi((s) => s.closeSearch)
  const openSearch = useBoardUi((s) => s.openSearch)
  const load = useRulesStore((s) => s.load)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing =
        !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
      const ctrlK =
        (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k'
      const slash = e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey
      if ((ctrlK || slash) && !document.querySelector('dialog[open]')) {
        e.preventDefault()
        void load()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSearch, load])

  return (
    <Modal open={open} title="Search" onClose={close} wide>
      <Palette />
    </Modal>
  )
}
