// Quick-add stat blocks: AC, hit points and Dexterity modifier copied from the 2014 Monster Manual
// (see public/monster-manual-compendium.json for the full stat blocks).

export interface QuickMonster {
  id: string
  name: string
  ac: number
  hp: number
  dexMod: number
  note: string
}

export const QUICK_MONSTERS: QuickMonster[] = [
  { id: 'guard', name: 'Guard', ac: 16, hp: 11, dexMod: 1, note: 'Spear and shield; holds a line.' },
  { id: 'bandit', name: 'Bandit', ac: 12, hp: 11, dexMod: 1, note: 'Scimitar and light crossbow.' },
  { id: 'scout', name: 'Scout', ac: 13, hp: 16, dexMod: 2, note: 'Prefers range and cover.' },
  { id: 'goblin', name: 'Goblin', ac: 15, hp: 7, dexMod: 2, note: 'Fast; hits and hides.' },
  { id: 'wolf', name: 'Wolf', ac: 13, hp: 11, dexMod: 2, note: 'Pack tactics; knocks foes prone.' },
  { id: 'skeleton', name: 'Skeleton', ac: 13, hp: 13, dexMod: 2, note: 'Shortsword and shortbow.' },
  { id: 'zombie', name: 'Zombie', ac: 8, hp: 22, dexMod: -2, note: 'Slow; hard to put down.' },
  { id: 'ogre', name: 'Ogre', ac: 11, hp: 59, dexMod: -1, note: 'Large; one heavy attack.' },
  { id: 'mage', name: 'Mage', ac: 12, hp: 40, dexMod: 2, note: 'A spellcaster with damaging spells.' },
  { id: 'giant-spider', name: 'Giant Spider', ac: 14, hp: 26, dexMod: 3, note: 'Poison bite; webs.' },
  { id: 'troll', name: 'Troll', ac: 15, hp: 84, dexMod: 1, note: 'Three attacks; regenerates.' },
  { id: 'knight', name: 'Knight', ac: 18, hp: 52, dexMod: 0, note: 'Leader; several attacks per turn.' },
]
