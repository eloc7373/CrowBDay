// tileset.json: lets a DM drop in their own PNG sprite sheet laid out on a grid.
// This module is pure (no DOM) so it can be unit tested; see README "Adding a tileset".
//
// Minimal example:
//   { "name": "My Dungeon", "tileSize": 64, "columns": 8, "rows": 4,
//     "tiles": [ { "id": "floor", "name": "Floor", "index": 0, "variants": [1, 2] } ] }

import {
  ASSET_CATEGORIES,
  type AssetCategory,
  type AssetDef,
  type AssetKind,
  type Frame,
} from './types'

export const TILESET_FORMAT = 'dmtk-tileset@1'

const KINDS: AssetKind[] = ['tile', 'prop', 'token']

export interface TileEntry {
  id: string
  name?: string
  /** Position in the sheet, row-major from 0. Alternatively give col + row. */
  index?: number
  col?: number
  row?: number
  /** Extra sheet indices used as random visual variants (tiles only). */
  variants?: number[]
  kind?: AssetKind
  category?: AssetCategory
  /** [w, h] in cells; the sprite spans that many sheet tiles from its index. */
  footprint?: [number, number]
  blocksMovement?: boolean
  blocksSight?: boolean
  difficultTerrain?: boolean
  tags?: string[]
}

export interface AutotileEntry {
  /** Tile id this rule applies to. */
  tile: string
  mode?: 'edge4'
  /** Other tile ids that count as "the same" for edge matching. */
  matches?: string[]
  /** Neighbour mask (N=1, E=2, S=4, W=8; "0"–"15") → sheet index. */
  masks: Record<string, number>
}

export interface TilesetFile {
  format?: string
  name: string
  /** File name of the PNG next to the JSON (informational; the dialog asks for the file). */
  image?: string
  tileSize?: number
  tileWidth?: number
  tileHeight?: number
  /** Optional when the image size is known: derived from it. */
  columns?: number
  rows?: number
  margin?: number
  spacing?: number
  author?: string
  license?: string
  url?: string
  /** Defaults applied to every tile entry. */
  defaults?: Omit<TileEntry, 'id' | 'name' | 'index' | 'col' | 'row' | 'variants'>
  /** Omit to import every non-empty cell of the sheet as a terrain tile. */
  tiles?: TileEntry[]
  autotile?: AutotileEntry[]
}

export interface ParsedTileset {
  id: string
  name: string
  tileWidth: number
  tileHeight: number
  columns: number
  rows: number
  author?: string
  license?: string
  url?: string
  assets: AssetDef[]
}

export type ParseResult =
  { ok: true; tileset: ParsedTileset; warnings: string[] } | { ok: false; errors: string[] }

export interface ParseOptions {
  imageWidth?: number
  imageHeight?: number
  /** Overrides the id derived from the name. */
  id?: string
  /** Used when `tiles` is omitted to skip fully transparent cells. */
  isFrameEmpty?: (frame: Frame) => boolean
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tileset'
  )
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0
const isNonNegInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

export function parseTileset(input: unknown, opts: ParseOptions = {}): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isObj(input)) return { ok: false, errors: ['The tileset file must be a JSON object.'] }
  const f = input as Partial<TilesetFile>

  if (f.format !== undefined && f.format !== TILESET_FORMAT) {
    errors.push(
      `format: expected "${TILESET_FORMAT}" (or omit it), got ${JSON.stringify(f.format)}.`,
    )
  }
  if (typeof f.name !== 'string' || !f.name.trim())
    errors.push('name: required, e.g. "My Dungeon Tiles".')

  const tw = f.tileWidth ?? f.tileSize
  const th = f.tileHeight ?? f.tileSize
  if (!isPosInt(tw) || !isPosInt(th)) {
    errors.push('tileSize: required positive whole number of pixels (or tileWidth + tileHeight).')
  }
  const margin = f.margin ?? 0
  const spacing = f.spacing ?? 0
  if (!isNonNegInt(margin)) errors.push('margin: must be a whole number ≥ 0.')
  if (!isNonNegInt(spacing)) errors.push('spacing: must be a whole number ≥ 0.')
  // Without a valid grid nothing else can be checked; otherwise keep collecting errors.
  if (!isPosInt(tw) || !isPosInt(th) || !isNonNegInt(margin) || !isNonNegInt(spacing)) {
    return { ok: false, errors }
  }
  const tsName = typeof f.name === 'string' ? f.name.trim() : ''

  // Columns/rows: explicit, or derived from the image size.
  const fit = (size: number | undefined, tile: number) =>
    size === undefined ? undefined : Math.floor((size - 2 * margin + spacing) / (tile + spacing))
  const columns = f.columns ?? fit(opts.imageWidth, tw!)
  const rows = f.rows ?? fit(opts.imageHeight, th!)
  if (!isPosInt(columns))
    errors.push(
      'columns: required positive whole number (or provide the image so it can be measured).',
    )
  if (!isPosInt(rows))
    errors.push(
      'rows: required positive whole number (or provide the image so it can be measured).',
    )
  if (!isPosInt(columns) || !isPosInt(rows)) return { ok: false, errors }

  const sheetW = 2 * margin + columns! * tw! + (columns! - 1) * spacing
  const sheetH = 2 * margin + rows! * th! + (rows! - 1) * spacing
  if (opts.imageWidth !== undefined && opts.imageHeight !== undefined) {
    if (sheetW > opts.imageWidth || sheetH > opts.imageHeight) {
      errors.push(
        `The grid (${columns} × ${rows} tiles of ${tw}×${th} px = ${sheetW}×${sheetH} px) is larger than the image (${opts.imageWidth}×${opts.imageHeight} px). Check tileSize, columns and rows.`,
      )
      return { ok: false, errors }
    }
  }

  const tsId = opts.id ?? slugify(tsName)
  const total = columns! * rows!
  const frameAt = (index: number, w = 1, h = 1): Frame => {
    const col = index % columns!
    const row = Math.floor(index / columns!)
    return {
      x: margin + col * (tw! + spacing),
      y: margin + row * (th! + spacing),
      w: w * tw! + (w - 1) * spacing,
      h: h * th! + (h - 1) * spacing,
    }
  }
  const checkIndex = (where: string, index: unknown, w = 1, h = 1): index is number => {
    if (!isNonNegInt(index)) {
      errors.push(`${where}: must be a whole number ≥ 0.`)
      return false
    }
    if (index >= total) {
      errors.push(
        `${where}: ${index} is outside the sheet (${columns} columns × ${rows} rows = ${total} tiles, indices 0–${total - 1}).`,
      )
      return false
    }
    const col = index % columns!
    const row = Math.floor(index / columns!)
    if (col + w > columns! || row + h > rows!) {
      errors.push(
        `${where}: a ${w}×${h} footprint starting at column ${col}, row ${row} runs off the sheet.`,
      )
      return false
    }
    return true
  }

  const defaults = isObj(f.defaults) ? (f.defaults as TilesetFile['defaults'])! : {}
  let entries: TileEntry[]
  if (f.tiles === undefined) {
    entries = []
    for (let i = 0; i < total; i++) {
      if (opts.isFrameEmpty?.(frameAt(i))) continue
      entries.push({ id: `t${i}`, name: `${tsName} ${i + 1}`, index: i })
    }
    if (!entries.length) errors.push('The image has no non-empty tiles at this tile size.')
  } else if (!Array.isArray(f.tiles)) {
    errors.push('tiles: must be an array of tile entries.')
    entries = []
  } else {
    entries = f.tiles as TileEntry[]
  }

  const seen = new Set<string>()
  const assets: AssetDef[] = []
  entries.forEach((raw, i) => {
    const where = `tiles[${i}]`
    if (!isObj(raw)) return errors.push(`${where}: must be an object.`)
    const t = { ...defaults, ...raw } as TileEntry
    if (typeof t.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(t.id)) {
      return errors.push(`${where}.id: required; letters, digits, "-" and "_" only.`)
    }
    if (seen.has(t.id)) return errors.push(`${where}.id: "${t.id}" is used more than once.`)
    seen.add(t.id)
    const kind = t.kind ?? 'tile'
    if (!KINDS.includes(kind))
      return errors.push(`${where}.kind: must be one of ${KINDS.join(', ')}.`)
    const category =
      t.category ?? (kind === 'tile' ? 'terrain' : kind === 'token' ? 'tokens' : 'props')
    if (!ASSET_CATEGORIES.includes(category)) {
      return errors.push(`${where}.category: must be one of ${ASSET_CATEGORIES.join(', ')}.`)
    }
    const [w, h] = kind === 'tile' ? [1, 1] : (t.footprint ?? [1, 1])
    if (!isPosInt(w) || !isPosInt(h))
      return errors.push(`${where}.footprint: must be [width, height] in cells.`)
    if (kind === 'tile' && t.footprint && (t.footprint[0] !== 1 || t.footprint[1] !== 1)) {
      warnings.push(`${where}.footprint: tiles are always 1×1; ignored.`)
    }
    let index = t.index
    if (index === undefined && t.col !== undefined && t.row !== undefined) {
      if (!isNonNegInt(t.col) || !isNonNegInt(t.row) || t.col >= columns! || t.row >= rows!) {
        return errors.push(
          `${where}: col/row (${t.col}, ${t.row}) is outside the ${columns}×${rows} sheet.`,
        )
      }
      index = t.row * columns! + t.col
    }
    if (index === undefined) return errors.push(`${where}: give "index" or "col" + "row".`)
    if (!checkIndex(`${where}.index`, index, w, h)) return
    const frames = [frameAt(index, w, h)]
    for (const [j, v] of (t.variants ?? []).entries()) {
      if (checkIndex(`${where}.variants[${j}]`, v)) frames.push(frameAt(v))
    }
    if (
      t.tags !== undefined &&
      !(Array.isArray(t.tags) && t.tags.every((x) => typeof x === 'string'))
    ) {
      return errors.push(`${where}.tags: must be an array of strings.`)
    }
    assets.push({
      id: `${tsId}:${t.id}`,
      name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : t.id,
      kind,
      category,
      footprint: { w, h },
      blocksMovement: t.blocksMovement ?? false,
      blocksSight: t.blocksSight ?? false,
      difficultTerrain: t.difficultTerrain ?? false,
      tags: (t.tags ?? []).map((s) => s.toLowerCase()),
      art: { type: 'image', tilesetId: tsId, frames },
      source: tsName,
      license: f.license,
    })
  })

  // Edge-matching rules.
  if (f.autotile !== undefined) {
    if (!Array.isArray(f.autotile)) errors.push('autotile: must be an array of rules.')
    else {
      f.autotile.forEach((rule, i) => {
        const where = `autotile[${i}]`
        if (!isObj(rule)) return errors.push(`${where}: must be an object.`)
        const r = rule as AutotileEntry
        const asset = assets.find((a) => a.id === `${tsId}:${r.tile}`)
        if (!asset)
          return errors.push(`${where}.tile: "${r.tile}" is not a tile id in this tileset.`)
        if (asset.kind !== 'tile')
          return errors.push(`${where}.tile: autotile only applies to tiles.`)
        if ((r.mode ?? 'edge4') !== 'edge4')
          return errors.push(`${where}.mode: only "edge4" is supported.`)
        if (!isObj(r.masks)) return errors.push(`${where}.masks: required object of mask → index.`)
        const frames: Partial<Record<number, Frame>> = {}
        for (const [k, v] of Object.entries(r.masks)) {
          const mask = Number(k)
          if (!Number.isInteger(mask) || mask < 0 || mask > 15) {
            errors.push(`${where}.masks["${k}"]: mask must be 0–15 (N=1, E=2, S=4, W=8).`)
            continue
          }
          if (checkIndex(`${where}.masks["${k}"]`, v)) frames[mask] = frameAt(v)
        }
        const matches = [asset.id]
        for (const m of r.matches ?? []) {
          if (!seen.has(m))
            warnings.push(`${where}.matches: "${m}" is not a tile id in this tileset.`)
          else matches.push(`${tsId}:${m}`)
        }
        asset.autotile = { mode: 'edge4', matches, frames }
      })
    }
  }

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    warnings,
    tileset: {
      id: tsId,
      name: tsName,
      tileWidth: tw!,
      tileHeight: th!,
      columns: columns!,
      rows: rows!,
      author: f.author,
      license: f.license,
      url: f.url,
      assets,
    },
  }
}

/** Neighbour mask for edge4 autotiling: N=1, E=2, S=4, W=8. */
export function edgeMask(
  tiles: Record<string, string>,
  x: number,
  y: number,
  matches: readonly string[],
): number {
  const same = (k: string) => {
    const t = tiles[k]
    return t !== undefined && matches.includes(t)
  }
  return (
    (same(`${x},${y - 1}`) ? 1 : 0) |
    (same(`${x + 1},${y}`) ? 2 : 0) |
    (same(`${x},${y + 1}`) ? 4 : 0) |
    (same(`${x - 1},${y}`) ? 8 : 0)
  )
}
