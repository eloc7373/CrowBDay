// Validation for rules content (bundled files or user imports). Accepts
// either an array of entries or `{ name?, notice?, entries: [...] }`. Invalid
// entries are skipped and reported; valid ones are kept.

import { RULE_CATEGORIES, type RuleEntry } from './types'

export interface RulesValidation {
  name?: string
  notice?: string
  entries: RuleEntry[]
  errors: string[]
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isStrArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

export function validateRules(input: unknown): RulesValidation {
  const errors: string[] = []
  let list: unknown
  let name: string | undefined
  let notice: string | undefined
  if (Array.isArray(input)) list = input
  else if (isObj(input) && Array.isArray(input.entries)) {
    list = input.entries
    if (typeof input.name === 'string') name = input.name
    if (typeof input.notice === 'string') notice = input.notice
  } else {
    return {
      entries: [],
      errors: ['Expected an array of rule entries, or an object with an "entries" array.'],
    }
  }

  const entries: RuleEntry[] = []
  const seen = new Set<string>()
  ;(list as unknown[]).forEach((raw, i) => {
    const where = `entries[${i}]`
    if (!isObj(raw)) return errors.push(`${where}: must be an object.`)
    const problems: string[] = []
    const id = raw.id
    if (typeof id !== 'string' || !id.trim()) problems.push('id: required string')
    else if (seen.has(id)) problems.push(`id: "${id}" is used more than once`)
    if (typeof raw.title !== 'string' || !raw.title.trim()) problems.push('title: required string')
    if (!RULE_CATEGORIES.includes(raw.category as never))
      problems.push(`category: must be one of ${RULE_CATEGORIES.join(', ')}`)
    if (typeof raw.summary !== 'string') problems.push('summary: required string')
    if (typeof raw.body !== 'string') problems.push('body: required string (markdown)')
    const src = raw.source
    if (!isObj(src) || typeof src.book !== 'string' || typeof src.license !== 'string') {
      problems.push('source: required { book, license, page? }')
    } else if (src.page !== undefined && typeof src.page !== 'number')
      problems.push('source.page: must be a number')
    if (raw.tags !== undefined && !isStrArray(raw.tags))
      problems.push('tags: must be an array of strings')
    if (raw.related !== undefined && !isStrArray(raw.related))
      problems.push('related: must be an array of ids')
    if (problems.length) {
      const label = typeof id === 'string' ? ` ("${id}")` : ''
      return errors.push(`${where}${label}: ${problems.join('; ')}.`)
    }
    seen.add(id as string)
    entries.push({
      id: id as string,
      title: (raw.title as string).trim(),
      category: raw.category as RuleEntry['category'],
      summary: raw.summary as string,
      body: raw.body as string,
      source: {
        book: (src as Record<string, string>).book,
        license: (src as Record<string, string>).license,
        ...(typeof (src as Record<string, unknown>).page === 'number'
          ? { page: (src as Record<string, number>).page }
          : {}),
      },
      tags: ((raw.tags as string[] | undefined) ?? []).map((t) => t.toLowerCase()),
      related: (raw.related as string[] | undefined) ?? [],
    })
  })
  return { name, notice, entries, errors }
}
