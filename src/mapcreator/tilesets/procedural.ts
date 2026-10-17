// Procedural placeholder art. Every pattern draws into a w×h pixel box with a
// seeded rng so tile variants are stable across sessions.

type Ctx = CanvasRenderingContext2D
type Draw = (ctx: Ctx, w: number, h: number, rnd: () => number, colors: string[]) => void

const speckle = (ctx: Ctx, w: number, h: number, rnd: () => number, colors: string[], n = 40) => {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[1 + (i % (colors.length - 1))] ?? colors[0]
    const s = 1 + rnd() * (w / 30)
    ctx.fillRect(rnd() * w, rnd() * h, s, s)
  }
}

const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

const terrain: Record<string, Draw> = {
  solid: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(0, 0, w, h)
  },
  speckle: (ctx, w, h, rnd, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, rnd, c, 45)
  },
  flagstones: (ctx, w, h, rnd, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(1, w / 35)
    const split = 0.35 + rnd() * 0.3
    ctx.strokeRect(0, 0, w, h)
    ctx.beginPath()
    ctx.moveTo(0, h * split)
    ctx.lineTo(w, h * split)
    ctx.moveTo(w * (0.3 + rnd() * 0.4), 0)
    ctx.lineTo(w * (0.3 + rnd() * 0.4), h * split)
    ctx.moveTo(w * (0.2 + rnd() * 0.6), h * split)
    ctx.lineTo(w * (0.2 + rnd() * 0.6), h)
    ctx.stroke()
    speckle(ctx, w, h, rnd, [c[0], c[2] ?? c[1]], 12)
  },
  planks: (ctx, w, h, rnd, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(0, 0, w, h)
    const rows = 4
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(1, w / 50)
    for (let i = 0; i < rows; i++) {
      const y = (i * h) / rows
      ctx.fillStyle = i % 2 ? c[0] : (c[2] ?? c[0])
      ctx.fillRect(0, y, w, h / rows)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      const seam = rnd() * w
      ctx.moveTo(seam, y)
      ctx.lineTo(seam, y + h / rows)
      ctx.stroke()
    }
  },
  grass: (ctx, w, h, rnd, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(0, 0, w, h)
    ctx.lineWidth = Math.max(1, w / 50)
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = c[1 + (i % (c.length - 1))]
      const x = rnd() * w
      const y = rnd() * h
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rnd() - 0.5) * w * 0.08, y - h * 0.08)
      ctx.stroke()
    }
  },
  water: (ctx, w, h, rnd, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(1, w / 40)
    for (let i = 0; i < 4; i++) {
      const x = rnd() * w * 0.7
      const y = rnd() * h
      ctx.beginPath()
      ctx.arc(x + w * 0.1, y, w * 0.1, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    }
  },
}

const props: Record<string, Draw> = {
  table: (ctx, w, h, _r, c) => {
    roundRect(ctx, w * 0.08, h * 0.12, w * 0.84, h * 0.76, w * 0.06)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.lineWidth = Math.max(2, w / 30)
    ctx.strokeStyle = c[1]
    ctx.stroke()
  },
  chair: (ctx, w, h, _r, c) => {
    roundRect(ctx, w * 0.25, h * 0.3, w * 0.5, h * 0.5, w * 0.05)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.25, h * 0.18, w * 0.5, h * 0.12)
  },
  barrel: (ctx, w, h, _r, c) => {
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.38, 0, Math.PI * 2)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.lineWidth = Math.max(2, w / 25)
    ctx.strokeStyle = c[1]
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.24, 0, Math.PI * 2)
    ctx.stroke()
  },
  crate: (ctx, w, h, _r, c) => {
    const p = w * 0.12
    ctx.fillStyle = c[0]
    ctx.fillRect(p, p, w - 2 * p, h - 2 * p)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(2, w / 25)
    ctx.strokeRect(p, p, w - 2 * p, h - 2 * p)
    ctx.beginPath()
    ctx.moveTo(p, p)
    ctx.lineTo(w - p, h - p)
    ctx.moveTo(w - p, p)
    ctx.lineTo(p, h - p)
    ctx.stroke()
  },
  bed: (ctx, w, h, _r, c) => {
    roundRect(ctx, w * 0.1, h * 0.05, w * 0.8, h * 0.9, w * 0.08)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.1, h * 0.35, w * 0.8, h * 0.6)
    roundRect(ctx, w * 0.2, h * 0.1, w * 0.6, h * 0.18, w * 0.06)
    ctx.fillStyle = c[2] ?? '#fff'
    ctx.fill()
  },
  tree: (ctx, w, h, rnd, c) => {
    const r = Math.min(w, h) / 2
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(
        w / 2 + Math.cos(a) * r * 0.45,
        h / 2 + Math.sin(a) * r * 0.45,
        r * (0.4 + rnd() * 0.1),
        0,
        Math.PI * 2,
      )
      ctx.fillStyle = c[i % 2]
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r * 0.45, 0, Math.PI * 2)
    ctx.fillStyle = c[2] ?? c[0]
    ctx.fill()
  },
  pillar: (ctx, w, h, _r, c) => {
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.lineWidth = Math.max(2, w / 20)
    ctx.strokeStyle = c[1]
    ctx.stroke()
  },
  chest: (ctx, w, h, _r, c) => {
    roundRect(ctx, w * 0.15, h * 0.25, w * 0.7, h * 0.5, w * 0.05)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.15, h * 0.42, w * 0.7, h * 0.08)
    ctx.fillRect(w * 0.46, h * 0.38, w * 0.08, h * 0.16)
  },
  token: (ctx, w, h, _r, c) => {
    const r = Math.min(w, h) * 0.42
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.lineWidth = Math.max(2, w / 18)
    ctx.strokeStyle = c[1]
    ctx.stroke()
  },
}

const fallback: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#ff00ff'
  ctx.fillRect(0, 0, w, h)
}

export function drawPattern(
  ctx: Ctx,
  pattern: string,
  w: number,
  h: number,
  rnd: () => number,
  colors: string[],
): void {
  const fn = terrain[pattern] ?? props[pattern] ?? fallback
  ctx.save()
  fn(ctx, w, h, rnd, colors)
  ctx.restore()
}
