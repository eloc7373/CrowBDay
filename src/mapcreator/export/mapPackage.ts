// Versioned map package (.dmtk-map.json): save/load the full map state.
// Validation uses the JSON Schema in src/data/map-package.schema.json (the
// source of truth), plus checks a schema can't express (bounds, id/key match).

import Ajv, { type ErrorObject } from 'ajv'
import schema from '../../data/map-package.schema.json'
import { parseCellKey } from '../../lib/geometry'
import { edgeInBounds, parseEdgeKey, type MapDoc } from '../layers/model'
import { propRect } from '../tools/paint'
import { slugName } from './layout'

export const MAP_FORMAT = 'dmtk-map'
export const MAP_VERSION = 1

export type MapPackage = { format: typeof MAP_FORMAT; version: number } & MapDoc

export function toPackage(doc: MapDoc, now = new Date().toISOString()): MapPackage {
  return { format: MAP_FORMAT, version: MAP_VERSION, ...structuredClone(doc), updatedAt: now }
}

export function fromPackage(pkg: MapPackage): MapDoc {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { format, version, ...doc } = pkg
  return doc
}

export const packageFilename = (doc: MapDoc) => `${slugName(doc.name)}.dmtk-map.json`

// ---- Migration ----------------------------------------------------------------

type RawPackage = Record<string, unknown> & { version?: unknown }

/**
 * Upgrades older package versions one step at a time. Add an entry here when
 * MAP_VERSION is bumped, e.g. `1: (p) => ({ ...p, version: 2, newField: … })`.
 */
const MIGRATIONS: Record<number, (p: RawPackage) => RawPackage> = {
  // No older versions exist yet.
}

export function migratePackage(raw: RawPackage): RawPackage {
  let p = raw
  let v = typeof p.version === 'number' ? p.version : NaN
  if (!Number.isInteger(v) || v < 1)
    throw new PackageError(['version: must be a whole number ≥ 1.'])
  if (v > MAP_VERSION) {
    throw new PackageError([
      `This map was saved by a newer version of DM Toolkit (format version ${v}; this app reads up to ${MAP_VERSION}). Update the app to open it.`,
    ])
  }
  while (v < MAP_VERSION) {
    const step = MIGRATIONS[v]
    if (!step) throw new PackageError([`No migration from format version ${v}.`])
    p = step(p)
    v = p.version as number
  }
  // Maps exported before the assets table existed are still accepted.
  if (p.assets === undefined) p = { ...p, assets: {} }
  return p
}

// ---- Validation ---------------------------------------------------------------

export class PackageError extends Error {
  readonly errors: string[]
  constructor(errors: string[]) {
    super(errors.join('\n'))
    this.errors = errors
  }
}

const ajv = new Ajv({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

/** "/props/p1/rotation" → "props.p1.rotation" */
function readable(e: ErrorObject): string {
  const path = e.instancePath.replace(/^\//, '').replace(/\//g, '.') || '(root)'
  switch (e.keyword) {
    case 'required':
      return `${path === '(root)' ? '' : path + '.'}${(e.params as { missingProperty: string }).missingProperty}: is required.`
    case 'additionalProperties':
      return `${path}: unknown field "${(e.params as { additionalProperty: string }).additionalProperty}".`
    case 'enum':
      return `${path}: must be one of ${(e.params as { allowedValues: unknown[] }).allowedValues.map((v) => JSON.stringify(v)).join(', ')}.`
    case 'const':
      return `${path}: must be ${JSON.stringify((e.params as { allowedValue: unknown }).allowedValue)}.`
    case 'propertyNames':
      return `${path}: has a key with the wrong format (${e.message}).`
    case 'pattern':
      return `${path}: key "${path.split('.').pop()}" has the wrong format.`
    default:
      return `${path}: ${e.message}.`
  }
}

function semanticErrors(doc: MapDoc): string[] {
  const errs: string[] = []
  const { width: W, height: H } = doc
  for (const k of Object.keys(doc.tiles)) {
    const c = parseCellKey(k)
    if (c.x >= W || c.y >= H) errs.push(`tiles["${k}"]: outside the ${W}×${H} map.`)
  }
  for (const k of Object.keys(doc.walls)) {
    if (!edgeInBounds(parseEdgeKey(k), W, H)) errs.push(`walls["${k}"]: outside the ${W}×${H} map.`)
  }
  for (const [k, p] of Object.entries(doc.props)) {
    if (p.id !== k) errs.push(`props["${k}"].id: must match its key (found "${p.id}").`)
    const r = propRect(p)
    if (r.x + r.w > W || r.y + r.h > H)
      errs.push(`props["${k}"]: extends outside the ${W}×${H} map.`)
  }
  for (const [k, n] of Object.entries(doc.notes)) {
    if (n.id !== k) errs.push(`notes["${k}"].id: must match its key (found "${n.id}").`)
    if (n.x >= W || n.y >= H) errs.push(`notes["${k}"]: outside the ${W}×${H} map.`)
  }
  return errs
}

/** Parses, migrates and validates package text. Throws PackageError with readable messages. */
export function parsePackage(text: string): MapDoc {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    throw new PackageError([`The file is not valid JSON: ${(e as Error).message}`])
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new PackageError(['The file must contain a JSON object.'])
  }
  const r = raw as RawPackage
  if (r.format !== MAP_FORMAT) {
    throw new PackageError([
      `This is not a DM Toolkit map file (expected "format": "${MAP_FORMAT}"). Tilesets are imported from the asset library instead.`,
    ])
  }
  const migrated = migratePackage(r)
  if (!validate(migrated)) {
    const errors = [...new Set((validate.errors ?? []).map(readable))]
    throw new PackageError(
      errors.slice(0, 25).concat(errors.length > 25 ? [`…and ${errors.length - 25} more.`] : []),
    )
  }
  const doc = fromPackage(migrated as unknown as MapPackage)
  const errs = semanticErrors(doc)
  if (errs.length) throw new PackageError(errs.slice(0, 25))
  return doc
}
