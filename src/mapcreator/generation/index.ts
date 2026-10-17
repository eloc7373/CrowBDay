// Generator registry and merging of generated content into a map.

import { inBounds, parseCellKey } from '../../lib/geometry'
import { newId } from '../../lib/id'
import { edgeInBounds, parseEdgeKey, type MapDoc } from '../layers/model'
import { compact, metaChange, setChange, type Change } from '../store/history'
import { propRect } from '../tools/paint'
import { CAVE_DEFAULTS, generateCave, type CaveParams } from './cave'
import type { GeneratorKind, GenResult } from './common'
import { DUNGEON_DEFAULTS, generateDungeon, type DungeonParams } from './dungeon'
import { generateTavern, TAVERN_DEFAULTS, type TavernParams } from './tavern'
import { generateVillage, VILLAGE_DEFAULTS, type VillageParams } from './village'

export type { GeneratorKind, GenResult } from './common'

export interface GeneratorParams {
  cave: CaveParams
  dungeon: DungeonParams
  tavern: TavernParams
  village: VillageParams
}

export const GENERATOR_DEFAULTS: GeneratorParams = {
  cave: CAVE_DEFAULTS,
  dungeon: DUNGEON_DEFAULTS,
  tavern: TAVERN_DEFAULTS,
  village: VILLAGE_DEFAULTS,
}

export const GENERATOR_LABELS: Record<GeneratorKind, string> = {
  cave: 'Cave',
  dungeon: 'Dungeon',
  tavern: 'Tavern / building',
  village: 'Village / town',
}

export function runGenerator<K extends GeneratorKind>(
  kind: K,
  params: Partial<GeneratorParams[K]>,
  seed: string,
): GenResult {
  switch (kind) {
    case 'cave':
      return generateCave(params as Partial<CaveParams>, seed)
    case 'dungeon':
      return generateDungeon(params as Partial<DungeonParams>, seed)
    case 'tavern':
      return generateTavern(params as Partial<TavernParams>, seed)
    default:
      return generateVillage(params as Partial<VillageParams>, seed)
  }
}

export type MergeMode = 'replace' | 'overlay'

/**
 * Changes that apply a generated result to the map as ONE undo step.
 * - replace: the map is resized to the result and all content is replaced.
 * - overlay: the result is drawn over the existing map at (0, 0), clipped to it;
 *   room numbers continue after the map's existing room markers.
 */
export function generationChanges(doc: MapDoc, res: GenResult, mode: MergeMode): Change[] {
  const changes: (Change | null)[] = []
  const width = mode === 'replace' ? res.width : doc.width
  const height = mode === 'replace' ? res.height : doc.height

  if (mode === 'replace') {
    changes.push(metaChange(doc, 'width', res.width), metaChange(doc, 'height', res.height))
    for (const k in doc.tiles)
      if (!(k in res.tiles)) changes.push(setChange(doc, 'tiles', k, undefined))
    for (const k in doc.walls)
      if (!(k in res.walls)) changes.push(setChange(doc, 'walls', k, undefined))
    for (const k in doc.props) changes.push(setChange(doc, 'props', k, undefined))
    for (const k in doc.notes) changes.push(setChange(doc, 'notes', k, undefined))
  }

  for (const [k, t] of Object.entries(res.tiles)) {
    const c = parseCellKey(k)
    if (inBounds(c.x, c.y, width, height)) changes.push(setChange(doc, 'tiles', k, t))
  }
  for (const [k, wall] of Object.entries(res.walls)) {
    if (edgeInBounds(parseEdgeKey(k), width, height)) changes.push(setChange(doc, 'walls', k, wall))
  }
  for (const p of res.props) {
    const id = newId('prop')
    const r = propRect(p)
    if (r.x < 0 || r.y < 0 || r.x + r.w > width || r.y + r.h > height) continue
    changes.push(setChange(doc, 'props', id, { ...p, id }))
  }
  const roomOffset =
    mode === 'overlay' ? Math.max(0, ...Object.values(doc.notes).map((n) => n.number ?? 0)) : 0
  for (const n of res.notes) {
    if (!inBounds(n.x, n.y, width, height)) continue
    const id = newId('note')
    const number = n.number !== undefined ? n.number + roomOffset : undefined
    changes.push(
      setChange(doc, 'notes', id, {
        ...n,
        id,
        ...(number !== undefined ? { number } : {}),
        // Keep default "Room N" names in step with the renumbering.
        text: n.text === `Room ${n.number}` && number !== undefined ? `Room ${number}` : n.text,
      }),
    )
  }
  changes.push(metaChange(doc, 'seed', res.seed))
  return compact(changes)
}
