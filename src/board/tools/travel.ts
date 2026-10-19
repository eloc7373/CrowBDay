// Travel pace calculator. Values follow the 2014 Player's Handbook travel pace table
// (Player's Handbook p. 182, summarised in the core rules).

export type Pace = 'fast' | 'normal' | 'slow'

export const PACES: Record<
  Pace,
  { feetPerMinute: number; mph: number; milesPerDay: number; effect: string }
> = {
  fast: {
    feetPerMinute: 400,
    mph: 4,
    milesPerDay: 30,
    effect: '−5 to passive Wisdom (Perception)',
  },
  normal: { feetPerMinute: 300, mph: 3, milesPerDay: 24, effect: 'No special effect' },
  slow: { feetPerMinute: 200, mph: 2, milesPerDay: 18, effect: 'Able to use stealth' },
}

export interface TravelResult {
  feetPerMinute: number
  milesPerHour: number
  milesPerDay: number
  /** Days to cover `distance` (null if no distance given). */
  days: number | null
  /** Hours travelled beyond 8 per day (forced march). */
  forcedMarchHours: number
  /** DC of the Constitution save for the last forced-march hour, or null. */
  forcedMarchDc: number | null
}

/**
 * The book's day assumes 8 hours of travel, and its "per day" figures round the
 * fast pace (4 mph × 8 h = 32) down to 30 miles. So the daily figure is scaled
 * from the table for other hours rather than computed as mph × hours.
 */
export function travel(
  pace: Pace,
  hoursPerDay: number,
  difficult: boolean,
  distanceMiles?: number,
): TravelResult {
  const p = PACES[pace]
  const factor = difficult ? 0.5 : 1
  const hours = Math.max(0, Number.isFinite(hoursPerDay) ? hoursPerDay : 8)
  const milesPerDay = Math.round(((p.milesPerDay * hours) / 8) * factor * 10) / 10
  const extra = Math.max(0, Math.ceil(hours - 8))
  return {
    feetPerMinute: p.feetPerMinute * factor,
    milesPerHour: p.mph * factor,
    milesPerDay,
    days:
      distanceMiles && distanceMiles > 0 && milesPerDay > 0
        ? Math.round((distanceMiles / milesPerDay) * 10) / 10
        : null,
    forcedMarchHours: extra,
    forcedMarchDc: extra > 0 ? 10 + extra : null,
  }
}

export const DC_TABLE: { label: string; dc: number }[] = [
  { label: 'Very easy', dc: 5 },
  { label: 'Easy', dc: 10 },
  { label: 'Medium', dc: 15 },
  { label: 'Hard', dc: 20 },
  { label: 'Very hard', dc: 25 },
  { label: 'Nearly impossible', dc: 30 },
]
