// Quick-add stat blocks. These are ORIGINAL, generic, approximate numbers made up
// for fast table use; they are not official monster statistics.

export interface QuickMonster {
  id: string
  name: string
  ac: number
  hp: number
  dexMod: number
  note: string
}

export const QUICK_MONSTERS: QuickMonster[] = [
  {
    id: 'militia',
    name: 'Militia fighter',
    ac: 15,
    hp: 13,
    dexMod: 1,
    note: 'Spear and shield; holds a line.',
  },
  { id: 'skirmisher', name: 'Skirmisher', ac: 13, hp: 9, dexMod: 3, note: 'Fast, hits and runs.' },
  { id: 'archer', name: 'Archer', ac: 13, hp: 10, dexMod: 3, note: 'Prefers range and cover.' },
  {
    id: 'brute',
    name: 'Brute',
    ac: 12,
    hp: 30,
    dexMod: 0,
    note: 'Big club, hits hard, slow-witted.',
  },
  {
    id: 'adept',
    name: 'Hedge spellcaster',
    ac: 11,
    hp: 18,
    dexMod: 1,
    note: 'A couple of damaging spells.',
  },
  {
    id: 'pack-beast',
    name: 'Pack beast',
    ac: 12,
    hp: 12,
    dexMod: 2,
    note: 'Hunts in groups; knocks foes down.',
  },
  {
    id: 'large-beast',
    name: 'Large beast',
    ac: 13,
    hp: 45,
    dexMod: 0,
    note: 'Large; one heavy attack.',
  },
  {
    id: 'champion',
    name: 'Elite champion',
    ac: 17,
    hp: 65,
    dexMod: 1,
    note: 'Leader; several attacks per turn.',
  },
]
