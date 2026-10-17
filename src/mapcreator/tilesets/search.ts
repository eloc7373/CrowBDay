// Asset library search: every query word must match the name, a tag, the
// category or the source. Results are ranked so name matches come first.

import type { AssetCategory, AssetDef } from './types'

export interface AssetFilter {
  query?: string
  category?: AssetCategory | null
  /** All listed tags must be present. */
  tags?: string[]
  /** Restrict to one source (e.g. "Built-in" or a tileset name). */
  source?: string | null
}

function wordScore(def: AssetDef, word: string): number {
  const name = def.name.toLowerCase()
  if (name === word) return 100
  if (name.startsWith(word)) return 80
  if (name.split(/[\s-]+/).some((w) => w.startsWith(word))) return 60
  if (name.includes(word)) return 40
  if (def.tags.includes(word)) return 30
  if (def.tags.some((t) => t.startsWith(word))) return 20
  if (def.category.startsWith(word) || def.id.includes(word)) return 10
  if (def.source.toLowerCase().includes(word)) return 5
  return 0
}

export function searchAssets(assets: readonly AssetDef[], filter: AssetFilter): AssetDef[] {
  const words = (filter.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const scored: { def: AssetDef; score: number }[] = []
  for (const def of assets) {
    if (filter.category && def.category !== filter.category) continue
    if (filter.source && def.source !== filter.source) continue
    if (filter.tags?.length && !filter.tags.every((t) => def.tags.includes(t))) continue
    let score = 0
    let all = true
    for (const w of words) {
      const s = wordScore(def, w)
      if (!s) {
        all = false
        break
      }
      score += s
    }
    if (all) scored.push({ def, score })
  }
  if (!words.length) return scored.map((s) => s.def)
  return scored
    .sort((a, b) => b.score - a.score || a.def.name.localeCompare(b.def.name))
    .map((s) => s.def)
}

/** Most common tags among the given assets, for filter chips. */
export function topTags(assets: readonly AssetDef[], limit = 12): string[] {
  const counts = new Map<string, number>()
  for (const a of assets) for (const t of a.tags) if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([t]) => t)
}
