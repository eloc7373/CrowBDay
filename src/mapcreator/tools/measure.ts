import type { Cell } from '../../lib/geometry'

/**
 * How diagonal movement is counted:
 * - alternating: 5 ft, 10 ft, 5 ft, … (the "5/10" variant)
 * - five: every diagonal step costs one square (5 ft)
 * - euclidean: straight-line distance
 */
export type DiagonalRule = 'alternating' | 'five' | 'euclidean'

export const DIAGONAL_RULE_LABELS: Record<DiagonalRule, string> = {
  alternating: 'Alternating 5/10 ft',
  five: '5 ft per diagonal',
  euclidean: 'Euclidean',
}

export interface Measurement {
  /** Distance in squares (may be fractional for euclidean). */
  squares: number
  feet: number
}

export function measure(a: Cell, b: Cell, rule: DiagonalRule, feetPerCell: number): Measurement {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  const long = Math.max(dx, dy)
  const diag = Math.min(dx, dy)
  let squares: number
  switch (rule) {
    case 'alternating':
      // Each diagonal costs 1 square, plus 1 extra for every second diagonal.
      squares = long + Math.floor(diag / 2)
      break
    case 'five':
      squares = long
      break
    case 'euclidean':
      squares = Math.round(Math.hypot(dx, dy) * 10) / 10
      break
  }
  return { squares, feet: Math.round(squares * feetPerCell * 10) / 10 }
}
