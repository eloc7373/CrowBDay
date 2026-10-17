// Selection: hit testing, rubber-band queries and move/delete/duplicate/rotate edits.

import { cellKey, inBounds, parseCellKey, type Rect } from '../../lib/geometry'
import { newId } from '../../lib/id'
import {
  edgeKey,
  nearestEdge,
  parseEdgeKey,
  type Footprint,
  type LayerId,
  type MapDoc,
  type PlacedProp,
  type PropRotation,
} from '../layers/model'
import { compact, setChange, type Change } from '../store/history'
import { propFootprint, propRect } from './paint'

export interface Selection {
  layer: LayerId
  ids: string[]
}

export const EMPTY_SELECTION: Selection = { layer: 'objects', ids: [] }

/** Topmost item of `layer` at world point (px, py) in cell units. */
export function hitTest(doc: MapDoc, layer: LayerId, px: number, py: number): string | null {
  const x = Math.floor(px)
  const y = Math.floor(py)
  switch (layer) {
    case 'terrain': {
      const k = cellKey(x, y)
      return doc.tiles[k] ? k : null
    }
    case 'walls': {
      const e = nearestEdge(px, py)
      return e.dist <= 0.25 && doc.walls[e.key] ? e.key : null
    }
    case 'objects':
    case 'tokens': {
      const hits = Object.values(doc.props).filter((p) => {
        if (p.layer !== layer) return false
        const r = propRect(p)
        return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h
      })
      return hits.length ? hits[hits.length - 1].id : null
    }
    case 'notes': {
      const hits = Object.values(doc.notes).filter((n) => n.x === x && n.y === y)
      return hits.length ? hits[hits.length - 1].id : null
    }
  }
}

/** Items of `layer` inside a cell rectangle. */
export function itemsInRect(doc: MapDoc, layer: LayerId, r: Rect): string[] {
  const inside = (x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h
  switch (layer) {
    case 'terrain':
      return Object.keys(doc.tiles).filter((k) => {
        const c = parseCellKey(k)
        return inside(c.x, c.y)
      })
    case 'walls':
      // Edges whose both end vertices lie within the rectangle's vertex span.
      return Object.keys(doc.walls).filter((k) => {
        const e = parseEdgeKey(k)
        const x2 = e.o === 'h' ? e.x + 1 : e.x
        const y2 = e.o === 'v' ? e.y + 1 : e.y
        return e.x >= r.x && e.y >= r.y && x2 <= r.x + r.w && y2 <= r.y + r.h
      })
    case 'objects':
    case 'tokens':
      return Object.values(doc.props)
        .filter((p) => {
          if (p.layer !== layer) return false
          const pr = propRect(p)
          return pr.x < r.x + r.w && r.x < pr.x + pr.w && pr.y < r.y + r.h && r.y < pr.y + pr.h
        })
        .map((p) => p.id)
    case 'notes':
      return Object.values(doc.notes)
        .filter((n) => inside(n.x, n.y))
        .map((n) => n.id)
  }
}

/** Allowed [lo, hi] offset ranges that keep every selected item inside the map. */
function deltaRange(doc: MapDoc, sel: Selection) {
  let dxLo = -Infinity
  let dxHi = Infinity
  let dyLo = -Infinity
  let dyHi = Infinity
  const box = (x: number, y: number, maxX: number, maxY: number) => {
    dxLo = Math.max(dxLo, -x)
    dxHi = Math.min(dxHi, maxX - x)
    dyLo = Math.max(dyLo, -y)
    dyHi = Math.min(dyHi, maxY - y)
  }
  const W = doc.width
  const H = doc.height
  for (const id of sel.ids) {
    switch (sel.layer) {
      case 'terrain': {
        const c = parseCellKey(id)
        box(c.x, c.y, W - 1, H - 1)
        break
      }
      case 'walls': {
        const e = parseEdgeKey(id)
        if (e.o === 'h') box(e.x, e.y, W - 1, H)
        else box(e.x, e.y, W, H - 1)
        break
      }
      case 'objects':
      case 'tokens': {
        const p = doc.props[id]
        if (!p) break
        const r = propRect(p)
        box(r.x, r.y, W - r.w, H - r.h)
        break
      }
      case 'notes': {
        const n = doc.notes[id]
        if (n) box(n.x, n.y, W - 1, H - 1)
        break
      }
    }
  }
  return { dxLo, dxHi, dyLo, dyHi }
}

export function clampDelta(doc: MapDoc, sel: Selection, dx: number, dy: number) {
  const r = deltaRange(doc, sel)
  // `+ 0` normalises -0 (from negating a zero coordinate) to 0.
  return {
    dx: Math.max(r.dxLo, Math.min(r.dxHi, dx)) + 0,
    dy: Math.max(r.dyLo, Math.min(r.dyHi, dy)) + 0,
  }
}

const shiftKey = (layer: LayerId, key: string, dx: number, dy: number) => {
  if (layer === 'terrain') {
    const c = parseCellKey(key)
    return cellKey(c.x + dx, c.y + dy)
  }
  const e = parseEdgeKey(key)
  return edgeKey(e.o, e.x + dx, e.y + dy)
}

/**
 * Builds the changes to move (copy = false) or duplicate (copy = true) the
 * selection by (dx, dy). Returns the selection of the moved/copied items.
 */
export function transformSelection(
  doc: MapDoc,
  sel: Selection,
  dx: number,
  dy: number,
  copy: boolean,
): { changes: Change[]; selection: Selection } {
  const d = clampDelta(doc, sel, dx, dy)
  dx = d.dx
  dy = d.dy
  if (sel.layer === 'terrain' || sel.layer === 'walls') {
    const coll = sel.layer === 'terrain' ? 'tiles' : 'walls'
    const source = doc[coll] as Record<string, unknown>
    const target = new Map<string, unknown>()
    if (!copy) for (const k of sel.ids) target.set(k, undefined)
    const ids: string[] = []
    for (const k of sel.ids) {
      const nk = shiftKey(sel.layer, k, dx, dy)
      target.set(nk, source[k])
      ids.push(nk)
    }
    const changes = compact(
      [...target].map(([k, v]) =>
        coll === 'tiles'
          ? setChange(doc, 'tiles', k, v as string | undefined)
          : setChange(doc, 'walls', k, v as MapDoc['walls'][string] | undefined),
      ),
    )
    return { changes, selection: { layer: sel.layer, ids } }
  }
  if (sel.layer === 'notes') {
    const ids: string[] = []
    const changes = compact(
      sel.ids.map((id) => {
        const n = doc.notes[id]
        if (!n) return null
        const nid = copy ? newId('note') : id
        ids.push(nid)
        return setChange(doc, 'notes', nid, { ...n, id: nid, x: n.x + dx, y: n.y + dy })
      }),
    )
    return { changes, selection: { layer: 'notes', ids } }
  }
  const ids: string[] = []
  const changes = compact(
    sel.ids.map((id) => {
      const p = doc.props[id]
      if (!p) return null
      const nid = copy ? newId('prop') : id
      ids.push(nid)
      return setChange(doc, 'props', nid, { ...p, id: nid, x: p.x + dx, y: p.y + dy })
    }),
  )
  return { changes, selection: { layer: sel.layer, ids } }
}

export function deleteSelection(doc: MapDoc, sel: Selection): Change[] {
  const coll = {
    terrain: 'tiles',
    walls: 'walls',
    objects: 'props',
    tokens: 'props',
    notes: 'notes',
  } as const
  return compact(sel.ids.map((id) => setChange(doc, coll[sel.layer], id, undefined)))
}

/** Rotates (by 90° steps) and/or mirrors selected props, keeping them on the map. */
export function reorientProps(
  doc: MapDoc,
  ids: string[],
  turns: number,
  mirror: boolean,
): Change[] {
  return compact(
    ids.map((id) => {
      const p = doc.props[id]
      if (!p) return null
      const rotation = ((((p.rotation + turns * 90) % 360) + 360) % 360) as PropRotation
      const fp = propFootprint(p.defId, rotation, p.token)
      const next: PlacedProp = {
        ...p,
        rotation,
        mirrored: mirror ? !p.mirrored : p.mirrored,
        x: Math.max(0, Math.min(doc.width - fp.w, p.x)),
        y: Math.max(0, Math.min(doc.height - fp.h, p.y)),
      }
      return setChange(doc, 'props', id, next)
    }),
  )
}

/** Top-left cell for placing a footprint centred under the cursor, clamped to the map. */
export function stampAnchor(doc: MapDoc, fp: Footprint, cx: number, cy: number) {
  const x = cx - Math.floor((fp.w - 1) / 2)
  const y = cy - Math.floor((fp.h - 1) / 2)
  const valid =
    inBounds(x, y, doc.width, doc.height) &&
    inBounds(x + fp.w - 1, y + fp.h - 1, doc.width, doc.height)
  return { x, y, w: fp.w, h: fp.h, valid }
}
