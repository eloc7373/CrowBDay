export const RULE_CATEGORIES = [
  'combat',
  'spellcasting',
  'conditions',
  'exploration',
  'social',
  'rest',
  'equipment',
  'other',
] as const
export type RuleCategory = (typeof RULE_CATEGORIES)[number]

export interface RuleEntry {
  /** e.g. "rules/combat/opportunity-attack" */
  id: string
  title: string
  category: RuleCategory
  /** 1–2 sentences, written by the app author. */
  summary: string
  /** Markdown. */
  body: string
  source: { book: string; page?: number; license: string }
  tags: string[]
  /** Other RuleEntry ids. */
  related: string[]
}

export interface RulesPack {
  id: string
  name: string
  notice?: string
  entries: RuleEntry[]
  /** Where it came from: bundled sample, src/data/srd at build time, or a user import. */
  origin: 'sample' | 'bundled' | 'imported'
}

export const isSpell = (e: RuleEntry) => e.tags.includes('spell')
