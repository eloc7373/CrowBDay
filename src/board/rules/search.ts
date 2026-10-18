// Fuzzy search across rules, spells and conditions (Fuse.js). Pure: give it
// documents, get a search function.

import Fuse from 'fuse.js'
import {
  CONDITIONS,
  CONDITIONS_SOURCE,
  conditionMarkdown,
  EXHAUSTION,
  exhaustionMarkdown,
} from '../conditions/data'
import { isSpell, type RuleEntry } from './types'

export type SearchKind = 'rule' | 'spell' | 'condition'

export interface SearchDoc {
  id: string
  kind: SearchKind
  title: string
  category: string
  summary: string
  body: string
  tags: string[]
  related: string[]
  source: { book: string; license: string; page?: number }
}

export function conditionDocs(): SearchDoc[] {
  const docs: SearchDoc[] = CONDITIONS.map((c) => ({
    id: `conditions/${c.id}`,
    kind: 'condition',
    title: c.name,
    category: 'conditions',
    summary: c.summary,
    body: conditionMarkdown(c),
    tags: ['condition', c.id],
    related: [],
    source: CONDITIONS_SOURCE,
  }))
  docs.push({
    id: 'conditions/exhaustion',
    kind: 'condition',
    title: EXHAUSTION.name,
    category: 'conditions',
    summary: EXHAUSTION.summary,
    body: exhaustionMarkdown(),
    tags: ['condition', 'exhaustion', 'fatigue', 'levels'],
    related: [],
    source: CONDITIONS_SOURCE,
  })
  return docs
}

export function ruleDocs(entries: RuleEntry[]): SearchDoc[] {
  return entries.map((e) => ({ ...e, kind: isSpell(e) ? 'spell' : 'rule' }))
}

export function createSearch(docs: SearchDoc[]) {
  const fuse = new Fuse(docs, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'tags', weight: 2 },
      { name: 'summary', weight: 1.5 },
      { name: 'body', weight: 1 },
    ],
    threshold: 0.35,
    // Match anywhere in long bodies, not just near the start.
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
  return (query: string, limit = 20): SearchDoc[] => {
    const q = query.trim()
    if (!q) return []
    return fuse.search(q, { limit }).map((r) => r.item)
  }
}
