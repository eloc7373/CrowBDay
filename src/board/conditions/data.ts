import data from '../../data/conditions.json'

export interface ConditionDef {
  id: string
  name: string
  summary: string
  effects: string[]
}

export interface ExhaustionDef {
  id: 'exhaustion'
  name: string
  summary: string
  note: string
  levels: string[]
  recovery: string
}

export const CONDITIONS: ConditionDef[] = data.conditions
export const EXHAUSTION = data.exhaustion as ExhaustionDef
export const CONDITIONS_NOTICE: string = data.notice
export const CONDITIONS_SOURCE = data.source

const byName = new Map(CONDITIONS.map((c) => [c.name.toLowerCase(), c]))

/** Looks up a condition by name, case-insensitively ("prone", "Prone"). */
export const findCondition = (name: string) => byName.get(name.trim().toLowerCase())

/** Markdown body for a condition (used by search and the entry viewer). */
export function conditionMarkdown(c: ConditionDef): string {
  return c.effects.map((e) => `- ${e}`).join('\n')
}

export function exhaustionMarkdown(): string {
  return [
    ...EXHAUSTION.levels.map((l, i) => `${i + 1}. ${l}`),
    '',
    EXHAUSTION.recovery,
    '',
    `_${EXHAUSTION.note}_`,
  ].join('\n')
}
