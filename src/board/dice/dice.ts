// Dice notation parser and roller.
//
// Grammar (whitespace ignored, case-insensitive):
//   expr  := term (('+' | '-') term)*
//   term  := dice | integer
//   dice  := [count] 'd' (sides | '%') [('kh' | 'kl') keep]
// Examples: d20, 1d20+5, 2d6-1, 4d6kh3, 2d20kl1, 3d8+2d6+4, d%
//
// Advantage/disadvantage applies to an expression with exactly one plain 1d20:
// it becomes 2d20kh1 / 2d20kl1.

export const LIMITS = { maxDice: 100, maxSides: 1000, maxTerms: 20 }

export class DiceError extends Error {
  readonly position: number
  constructor(message: string, position: number) {
    super(message)
    this.position = position
  }
}

export interface DiceTerm {
  kind: 'dice'
  sign: 1 | -1
  count: number
  sides: number
  keep: { mode: 'kh' | 'kl'; n: number } | null
}
export interface ConstTerm {
  kind: 'const'
  sign: 1 | -1
  value: number
}
export type Term = DiceTerm | ConstTerm

export function parseDice(input: string): Term[] {
  const src = input.toLowerCase()
  let i = 0
  const skip = () => {
    while (i < src.length && /\s/.test(src[i])) i++
  }
  const int = (): number | null => {
    const start = i
    while (i < src.length && /[0-9]/.test(src[i])) i++
    return i > start ? Number(src.slice(start, i)) : null
  }
  const describe = (pos: number) =>
    pos >= src.length ? 'the end' : `"${input[pos]}" at position ${pos + 1}`

  skip()
  if (i >= src.length) throw new DiceError('Enter a roll, for example 1d20+5 or 4d6kh3.', 0)

  const terms: Term[] = []
  let sign: 1 | -1 = 1
  // Optional leading sign, e.g. "-1+1d4".
  if (src[i] === '+' || src[i] === '-') {
    sign = src[i] === '-' ? -1 : 1
    i++
  }
  for (;;) {
    skip()
    const start = i
    const n = int()
    if (src[i] === 'd') {
      i++
      let sides: number | null
      if (src[i] === '%') {
        i++
        sides = 100
      } else sides = int()
      if (sides === null)
        throw new DiceError(`Expected the number of sides after "d" but found ${describe(i)}.`, i)
      const count = n ?? 1
      if (count < 1 || count > LIMITS.maxDice) {
        throw new DiceError(
          `Roll between 1 and ${LIMITS.maxDice} dice at a time (got ${count}).`,
          start,
        )
      }
      if (sides < 2 || sides > LIMITS.maxSides) {
        throw new DiceError(`Dice need 2 to ${LIMITS.maxSides} sides (got d${sides}).`, start)
      }
      let keep: DiceTerm['keep'] = null
      if (src.startsWith('kh', i) || src.startsWith('kl', i)) {
        const mode = src.slice(i, i + 2) as 'kh' | 'kl'
        i += 2
        const k = int()
        if (k === null)
          throw new DiceError(`Expected how many dice to keep after "${mode}" (e.g. ${mode}1).`, i)
        if (k < 1 || k > count) {
          throw new DiceError(
            `Can't keep ${k} of ${count} dice in ${count}d${sides}${mode}${k}.`,
            start,
          )
        }
        keep = { mode, n: k }
      } else if (src[i] === 'k') {
        throw new DiceError(
          `Use "kh" (keep highest) or "kl" (keep lowest) at position ${i + 1}.`,
          i,
        )
      }
      terms.push({ kind: 'dice', sign, count, sides, keep })
    } else if (n !== null) {
      terms.push({ kind: 'const', sign, value: n })
    } else {
      throw new DiceError(`Expected a number or dice (like 2d6) but found ${describe(i)}.`, i)
    }
    if (terms.length > LIMITS.maxTerms)
      throw new DiceError(`Use at most ${LIMITS.maxTerms} terms.`, i)
    skip()
    if (i >= src.length) break
    if (src[i] === '+' || src[i] === '-') {
      sign = src[i] === '+' ? 1 : -1
      i++
      skip()
      if (i >= src.length)
        throw new DiceError(
          `The roll ends with "${input.trim().slice(-1)}"; add a number or dice after it.`,
          i,
        )
      continue
    }
    throw new DiceError(`Unexpected ${describe(i)}. Use + or - between parts, e.g. 2d6+3.`, i)
  }
  return terms
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

export interface RolledTerm {
  term: Term
  /** Every die rolled (dice terms). */
  rolls: number[]
  /** Which rolls count toward the total. */
  kept: boolean[]
  subtotal: number
}

export interface RollResult {
  expression: string
  mode: RollMode
  /** True when advantage/disadvantage was requested and applied to a d20. */
  modeApplied: boolean
  terms: RolledTerm[]
  total: number
  /** Natural d20 result when the roll is a single d20 check (after adv/dis). */
  natural: number | null
  /** e.g. "1d20+5: [14] + 5 = 19" */
  text: string
}

/** Cryptographically strong integer in [1, sides]. */
export function cryptoDie(sides: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / sides) * sides
  let v: number
  do {
    crypto.getRandomValues(buf)
    v = buf[0]
  } while (v >= limit) // rejection sampling avoids modulo bias
  return (v % sides) + 1
}

const formatTerm = (t: Term) =>
  t.kind === 'const'
    ? String(t.value)
    : `${t.count}d${t.sides}${t.keep ? `${t.keep.mode}${t.keep.n}` : ''}`

export function formatTerms(terms: Term[]): string {
  return terms
    .map((t, i) => (i === 0 ? (t.sign < 0 ? '-' : '') : t.sign < 0 ? '-' : '+') + formatTerm(t))
    .join('')
}

export function roll(
  input: string,
  mode: RollMode = 'normal',
  die: (sides: number) => number = cryptoDie,
): RollResult {
  let terms = parseDice(input)
  const d20s = terms.filter((t): t is DiceTerm => t.kind === 'dice' && t.sides === 20)
  const plainD20 = d20s.length === 1 && d20s[0].count === 1 && !d20s[0].keep
  const modeApplied = mode !== 'normal' && plainD20
  if (modeApplied) {
    terms = terms.map((t) =>
      t === d20s[0]
        ? { ...t, count: 2, keep: { mode: mode === 'advantage' ? 'kh' : 'kl', n: 1 } }
        : t,
    )
  }

  const rolled: RolledTerm[] = terms.map((t) => {
    if (t.kind === 'const') return { term: t, rolls: [], kept: [], subtotal: t.sign * t.value }
    const rolls = Array.from({ length: t.count }, () => die(t.sides))
    const kept = rolls.map(() => true)
    if (t.keep) {
      // Keep the highest/lowest n; earlier dice win ties so results are stable.
      const idx = rolls.map((v, j) => [v, j] as const)
      idx.sort((a, b) => (t.keep!.mode === 'kh' ? b[0] - a[0] : a[0] - b[0]) || a[1] - b[1])
      kept.fill(false)
      for (const [, j] of idx.slice(0, t.keep.n)) kept[j] = true
    }
    const sum = rolls.reduce((acc, v, j) => acc + (kept[j] ? v : 0), 0)
    return { term: t, rolls, kept, subtotal: t.sign * sum }
  })

  const total = rolled.reduce((a, r) => a + r.subtotal, 0)
  // A "natural" result exists when exactly one d20 counts toward the total
  // (a plain d20, or 2d20kh1/kl1 for advantage/disadvantage).
  const d20Terms = rolled.filter((r) => r.term.kind === 'dice' && r.term.sides === 20)
  const keptD20 =
    d20Terms.length === 1 ? d20Terms[0].rolls.filter((_, j) => d20Terms[0].kept[j]) : []
  const natural = keptD20.length === 1 ? keptD20[0] : null
  const parts = rolled.map((r, i) => {
    const sign = i === 0 ? (r.term.sign < 0 ? '-' : '') : r.term.sign < 0 ? ' - ' : ' + '
    if (r.term.kind === 'const') return `${sign}${r.term.value}`
    const dice = r.rolls.map((v, j) => (r.kept[j] ? String(v) : `~~${v}~~`)).join(', ')
    return `${sign}[${dice}]`
  })
  const expression = formatTerms(terms)
  return {
    expression,
    mode,
    modeApplied,
    terms: rolled,
    total,
    natural,
    text: `${expression}: ${parts.join('')} = ${total}`,
  }
}
