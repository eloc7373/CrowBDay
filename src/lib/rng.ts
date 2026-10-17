// Seeded pseudo-random numbers. The same seed string always yields the same sequence.

/** FNV-1a hash of a string to an unsigned 32-bit integer. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mulberry32: small, fast, good-enough PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  next(): number
  int(min: number, maxInclusive: number): number
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
}

export function createRng(seed: string | number): Rng {
  const next = mulberry32(typeof seed === 'number' ? seed : hashString(seed))
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  }
}

/** Stable hash of integer coordinates, for per-cell variation in rendering. */
export function hashCoords(x: number, y: number, salt = 0): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/** Random human-friendly seed, e.g. "k3x9-p2qa". */
export function randomSeed(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 8; i++) {
    if (i === 4) s += '-'
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return s
}
