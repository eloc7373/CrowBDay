// Map document model. This is the source of truth that is edited, undone,
// persisted and (in Phase 4) exported as the versioned JSON map package.

import { newId } from '../../lib/id'

export const LAYER_IDS = ['terrain', 'walls', 'objects', 'tokens', 'notes'] as const
export type LayerId = (typeof LAYER_IDS)[number]

export const LAYER_NAMES: Record<LayerId, string> = {
  terrain: 'Terrain',
  walls: 'Walls & Doors',
  objects: 'Objects',
  tokens: 'Tokens',
  notes: 'Notes',
}

export interface LayerState {
  visible: boolean
  locked: boolean
  opacity: number
}

export interface GridSettings {
  /** Pixels per cell at 1× zoom. 70 px is the common VTT default. */
  cellSize: number
  /** Real-world feet represented by one cell (5e default: 5 ft). */
  feetPerCell: number
  visible: boolean
  color: string
  opacity: number
}

/** A unit wall segment on one cell edge. A door is a wall with the door flag. */
export interface WallEdge {
  door: boolean
  secret: boolean
}

export type PropRotation = 0 | 90 | 180 | 270

export interface PlacedProp {
  id: string
  layer: 'objects' | 'tokens'
  defId: string
  /** Top-left cell of the (rotated) footprint. */
  x: number
  y: number
  rotation: PropRotation
  mirrored: boolean
  label?: string
  /** Creature data; present on tokens (Tokens layer). */
  token?: TokenInfo
}

// ---- Tokens -------------------------------------------------------------
// Creature data lives on the token so HP/conditions edits are undoable map edits.
// Combat Mode (Phase 5B) links initiative entries to tokens by id.

export const TOKEN_SIDES = ['pc', 'ally', 'enemy', 'neutral'] as const
export type TokenSide = (typeof TOKEN_SIDES)[number]

export const CREATURE_SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const
export type CreatureSize = (typeof CREATURE_SIZES)[number]

/** Squares occupied on a 5 ft grid. Tiny creatures are shown in one square. */
export const SIZE_SQUARES: Record<CreatureSize, number> = {
  tiny: 1,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
}

export interface TokenHp {
  current: number
  max: number
  temp: number
}

export interface TokenInfo {
  name: string
  side: TokenSide
  size: CreatureSize
  hp: TokenHp | null
  ac: number | null
  /** Walking speed in feet. */
  speed: number | null
  /** Added to initiative rolls; also the Dex tiebreak in the tracker. */
  initiativeBonus: number | null
  conditions: string[]
  /** Hidden from the (future) player view. */
  hidden: boolean
}

export function defaultTokenInfo(name: string, side: TokenSide = 'neutral'): TokenInfo {
  return {
    name,
    side,
    size: 'medium',
    hp: null,
    ac: null,
    speed: null,
    initiativeBonus: null,
    conditions: [],
    hidden: false,
  }
}

// ---- Asset metadata ---------------------------------------------------------

/**
 * Copy of an asset's definition stored in the map, so movement/sight flags are
 * exportable and maps stay readable if a custom tileset is later removed.
 */
export interface AssetMeta {
  name: string
  kind: 'tile' | 'prop' | 'token'
  category: string
  footprint: Footprint
  blocksMovement: boolean
  blocksSight: boolean
  difficultTerrain: boolean
  tags: string[]
  source: string
}

export interface MapNote {
  id: string
  kind: 'label' | 'room'
  x: number
  y: number
  text: string
  /** Room marker number (kind === 'room'). */
  number?: number
}

export interface MapDoc {
  id: string
  name: string
  width: number
  height: number
  seed: string | null
  grid: GridSettings
  layers: Record<LayerId, LayerState>
  /** Terrain layer: cellKey "x,y" → tile id. Sparse; absent means empty. */
  tiles: Record<string, string>
  /** Walls layer: edge key (see edgeKey) → wall. */
  walls: Record<string, WallEdge>
  /** Objects and Tokens layers. */
  props: Record<string, PlacedProp>
  /** Notes layer. */
  notes: Record<string, MapNote>
  /** Metadata of every asset referenced by tiles/props (maintained automatically). */
  assets: Record<string, AssetMeta>
  createdAt: string
  updatedAt: string
}

export const DEFAULT_GRID: GridSettings = {
  cellSize: 70,
  feetPerCell: 5,
  visible: true,
  color: '#000000',
  opacity: 0.35,
}

export function defaultLayers(): Record<LayerId, LayerState> {
  return {
    terrain: { visible: true, locked: false, opacity: 1 },
    walls: { visible: true, locked: false, opacity: 1 },
    objects: { visible: true, locked: false, opacity: 1 },
    tokens: { visible: true, locked: false, opacity: 1 },
    notes: { visible: true, locked: false, opacity: 1 },
  }
}

export interface NewMapOptions {
  name?: string
  width?: number
  height?: number
  cellSize?: number
  feetPerCell?: number
}

export const MIN_MAP_SIZE = 1
export const MAX_MAP_SIZE = 200

export function createEmptyMap(opts: NewMapOptions = {}): MapDoc {
  const now = new Date().toISOString()
  return {
    id: newId('map'),
    name: opts.name ?? 'Untitled map',
    width: opts.width ?? 30,
    height: opts.height ?? 20,
    seed: null,
    grid: {
      ...DEFAULT_GRID,
      cellSize: opts.cellSize ?? DEFAULT_GRID.cellSize,
      feetPerCell: opts.feetPerCell ?? DEFAULT_GRID.feetPerCell,
    },
    layers: defaultLayers(),
    tiles: {},
    walls: {},
    props: {},
    notes: {},
    assets: {},
    createdAt: now,
    updatedAt: now,
  }
}

// ---- Wall edges -------------------------------------------------------------
// Grid vertices are at integer coordinates (0..width, 0..height).
// "h:x,y" is the horizontal edge from vertex (x,y) to (x+1,y), i.e. the top of cell (x,y).
// "v:x,y" is the vertical edge from vertex (x,y) to (x,y+1), i.e. the left of cell (x,y).

export type EdgeOrientation = 'h' | 'v'

export interface Edge {
  o: EdgeOrientation
  x: number
  y: number
}

export const edgeKey = (o: EdgeOrientation, x: number, y: number): string => `${o}:${x},${y}`

export function parseEdgeKey(key: string): Edge {
  const i = key.indexOf(',')
  return { o: key[0] as EdgeOrientation, x: Number(key.slice(2, i)), y: Number(key.slice(i + 1)) }
}

export function edgeInBounds(e: Edge, width: number, height: number): boolean {
  return e.o === 'h'
    ? e.x >= 0 && e.x < width && e.y >= 0 && e.y <= height
    : e.x >= 0 && e.x <= width && e.y >= 0 && e.y < height
}

/** The four edges surrounding a cell. */
export function cellEdgeKeys(x: number, y: number): string[] {
  return [edgeKey('h', x, y), edgeKey('h', x, y + 1), edgeKey('v', x, y), edgeKey('v', x + 1, y)]
}

/** Unit edges along the dominant axis from vertex a toward vertex b. */
export function edgesBetweenVertices(a: { x: number; y: number }, b: { x: number; y: number }) {
  const out: string[] = []
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return out
  if (Math.abs(dx) >= Math.abs(dy)) {
    const x0 = Math.min(a.x, b.x)
    for (let x = x0; x < x0 + Math.abs(dx); x++) out.push(edgeKey('h', x, a.y))
  } else {
    const y0 = Math.min(a.y, b.y)
    for (let y = y0; y < y0 + Math.abs(dy); y++) out.push(edgeKey('v', a.x, y))
  }
  return out
}

/** End vertex actually reached by edgesBetweenVertices (snapped to the dominant axis). */
export function constrainVertex(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y }
}

/** Nearest unit edge to a point in cell units, with the distance to it. */
export function nearestEdge(px: number, py: number): { key: string; dist: number } {
  const cx = Math.floor(px)
  const cy = Math.floor(py)
  const fx = px - cx
  const fy = py - cy
  const candidates: [string, number][] = [
    [edgeKey('h', cx, cy), fy],
    [edgeKey('h', cx, cy + 1), 1 - fy],
    [edgeKey('v', cx, cy), fx],
    [edgeKey('v', cx + 1, cy), 1 - fx],
  ]
  candidates.sort((a, b) => a[1] - b[1])
  return { key: candidates[0][0], dist: candidates[0][1] }
}

// ---- Props -----------------------------------------------------------------

export interface Footprint {
  w: number
  h: number
}

export function rotatedFootprint(fp: Footprint, rotation: PropRotation): Footprint {
  return rotation === 90 || rotation === 270 ? { w: fp.h, h: fp.w } : fp
}
