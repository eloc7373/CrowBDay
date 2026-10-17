// Procedural placeholder art. Every pattern draws into a w×h pixel box with a
// seeded rng so tile variants are stable across sessions.

type Ctx = CanvasRenderingContext2D
type Draw = (ctx: Ctx, w: number, h: number, rnd: () => number, colors: string[]) => void

const speckle = (
  ctx: Ctx,
  w: number,
  h: number,
  rnd: () => number,
  colors: string[],
  n = 40,
  scale = 30,
) => {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[1 + (i % (colors.length - 1))] ?? colors[0]
    const s = 1 + rnd() * (w / scale)
    ctx.fillRect(rnd() * w, rnd() * h, s, s)
  }
}

const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

const circle = (ctx: Ctx, x: number, y: number, r: number) => {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
}

const fill = (ctx: Ctx, color: string, w: number, h: number) => {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
}

const lw = (w: number, k: number) => Math.max(1, w / k)

const terrain: Record<string, Draw> = {
  solid: (ctx, w, h, _r, c) => fill(ctx, c[0], w, h),
  speckle: (ctx, w, h, rnd, c) => {
    fill(ctx, c[0], w, h)
    speckle(ctx, w, h, rnd, c, 45)
  },
  flagstones: (ctx, w, h, rnd, c) => {
    fill(ctx, c[0], w, h)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = lw(w, 35)
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
    fill(ctx, c[0], w, h)
    const rows = 4
    ctx.strokeStyle = c[1]
    ctx.lineWidth = lw(w, 50)
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
    fill(ctx, c[0], w, h)
    ctx.lineWidth = lw(w, 50)
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
    fill(ctx, c[0], w, h)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = lw(w, 40)
    for (let i = 0; i < 4; i++) {
      const x = rnd() * w * 0.7
      const y = rnd() * h
      ctx.beginPath()
      ctx.arc(x + w * 0.1, y, w * 0.1, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    }
  },
  lava: (ctx, w, h, rnd, c) => {
    fill(ctx, c[0], w, h)
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < 3 ? c[1] : c[2]
      ctx.beginPath()
      ctx.ellipse(
        rnd() * w,
        rnd() * h,
        w * (0.08 + rnd() * 0.15),
        h * (0.05 + rnd() * 0.1),
        rnd() * 3,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  },
  ice: (ctx, w, h, rnd, c) => {
    fill(ctx, c[0], w, h)
    ctx.strokeStyle = c[2]
    ctx.lineWidth = lw(w, 45)
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const x = rnd() * w
      const y = rnd() * h
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rnd() - 0.5) * w * 0.6, y + (rnd() - 0.5) * h * 0.6)
    }
    ctx.stroke()
    ctx.fillStyle = c[1]
    ctx.globalAlpha = 0.6
    ctx.fillRect(w * 0.1, h * 0.12, w * 0.25, h * 0.05)
  },
  rubble: (ctx, w, h, rnd, c) => {
    fill(ctx, c[1], w, h)
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = c[i % 2 ? 0 : 2]
      const s = w * (0.12 + rnd() * 0.14)
      ctx.beginPath()
      const x = rnd() * w
      const y = rnd() * h
      ctx.moveTo(x, y)
      ctx.lineTo(x + s, y + s * 0.2)
      ctx.lineTo(x + s * 0.7, y + s)
      ctx.lineTo(x - s * 0.2, y + s * 0.6)
      ctx.fill()
    }
  },
  mud: (ctx, w, h, rnd, c) => {
    fill(ctx, c[0], w, h)
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = c[1 + (i % 2)]
      ctx.beginPath()
      ctx.ellipse(rnd() * w, rnd() * h, w * 0.12, h * 0.06, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  cobble: (ctx, w, h, rnd, c) => {
    fill(ctx, c[1], w, h)
    const n = 3
    const s = w / n
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = rnd() > 0.5 ? c[0] : c[2]
        rr(ctx, x * s + s * 0.08 + (y % 2) * s * 0.15, y * s + s * 0.08, s * 0.8, s * 0.8, s * 0.25)
        ctx.fill()
      }
    }
  },
  pit: (ctx, w, h, _r, c) => {
    fill(ctx, c[0], w, h)
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w * 0.45)
    g.addColorStop(0, c[1])
    g.addColorStop(1, c[2])
    ctx.fillStyle = g
    rr(ctx, w * 0.08, h * 0.08, w * 0.84, h * 0.84, w * 0.12)
    ctx.fill()
  },
  chasm: (ctx, w, h, rnd, c) => {
    fill(ctx, c[0], w, h)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = lw(w, 30)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      const y = rnd() * h
      ctx.moveTo(0, y)
      ctx.lineTo(w, y + (rnd() - 0.5) * h * 0.3)
      ctx.stroke()
    }
  },
  bridge: (ctx, w, h, _r, c) => {
    fill(ctx, c[0], w, h)
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.1, 0, w * 0.8, h)
    ctx.strokeStyle = c[2]
    ctx.lineWidth = lw(w, 35)
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(w * 0.1, (i * h) / 4)
      ctx.lineTo(w * 0.9, (i * h) / 4)
      ctx.stroke()
    }
    ctx.fillStyle = c[2]
    ctx.fillRect(w * 0.06, 0, w * 0.06, h)
    ctx.fillRect(w * 0.88, 0, w * 0.06, h)
  },
  stairsUp: (ctx, w, h, _r, c) => stairs(ctx, w, h, c, true),
  stairsDown: (ctx, w, h, _r, c) => stairs(ctx, w, h, c, false),
  missing: (ctx, w, h) => {
    fill(ctx, '#ff00ff', w, h)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w / 2, h / 2)
    ctx.fillRect(w / 2, h / 2, w / 2, h / 2)
  },
}

function stairs(ctx: Ctx, w: number, h: number, c: string[], up: boolean) {
  const steps = 5
  for (let i = 0; i < steps; i++) {
    // Steps get darker toward "down".
    const t = up ? i / steps : 1 - i / steps
    ctx.fillStyle = t > 0.5 ? c[0] : c[1]
    ctx.fillRect(0, (i * h) / steps, w, h / steps)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = lw(w, 40)
    ctx.strokeRect(0, (i * h) / steps, w, h / steps)
  }
  ctx.fillStyle = c[2]
  ctx.beginPath()
  const tip = up ? h * 0.2 : h * 0.8
  const base = up ? h * 0.55 : h * 0.45
  ctx.moveTo(w / 2, tip)
  ctx.lineTo(w * 0.32, base)
  ctx.lineTo(w * 0.68, base)
  ctx.fill()
}

const props: Record<string, Draw> = {
  table: (ctx, w, h, _r, c) => {
    rr(ctx, w * 0.08, h * 0.12, w * 0.84, h * 0.76, w * 0.06)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.lineWidth = Math.max(2, w / 30)
    ctx.strokeStyle = c[1]
    ctx.stroke()
  },
  chair: (ctx, w, h, _r, c) => {
    rr(ctx, w * 0.25, h * 0.3, w * 0.5, h * 0.5, w * 0.05)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.25, h * 0.18, w * 0.5, h * 0.12)
  },
  barrel: (ctx, w, h, _r, c) => {
    circle(ctx, w / 2, h / 2, Math.min(w, h) * 0.38)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.lineWidth = Math.max(2, w / 25)
    ctx.strokeStyle = c[1]
    ctx.stroke()
    circle(ctx, w / 2, h / 2, Math.min(w, h) * 0.24)
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
    rr(ctx, w * 0.1, h * 0.05, w * 0.8, h * 0.9, w * 0.08)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.1, h * 0.35, w * 0.8, h * 0.6)
    rr(ctx, w * 0.2, h * 0.1, w * 0.6, h * 0.18, w * 0.06)
    ctx.fillStyle = c[2] ?? '#fff'
    ctx.fill()
  },
  bookshelf: (ctx, w, h, rnd, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(w * 0.03, h * 0.2, w * 0.94, h * 0.6)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(2, h / 20)
    ctx.strokeRect(w * 0.03, h * 0.2, w * 0.94, h * 0.6)
    let x = w * 0.06
    while (x < w * 0.92) {
      const bw = w * (0.03 + rnd() * 0.03)
      ctx.fillStyle = c[2 + Math.floor(rnd() * 3)]
      ctx.fillRect(x, h * 0.27, bw, h * 0.46)
      x += bw + w * 0.008
    }
  },
  tree: (ctx, w, h, rnd, c) => {
    const r = Math.min(w, h) / 2
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      circle(
        ctx,
        w / 2 + Math.cos(a) * r * 0.45,
        h / 2 + Math.sin(a) * r * 0.45,
        r * (0.4 + rnd() * 0.1),
      )
      ctx.fillStyle = c[i % 2]
      ctx.fill()
    }
    circle(ctx, w / 2, h / 2, r * 0.45)
    ctx.fillStyle = c[2] ?? c[0]
    ctx.fill()
  },
  pillar: (ctx, w, h, _r, c) => {
    circle(ctx, w / 2, h / 2, Math.min(w, h) * 0.4)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.lineWidth = Math.max(2, w / 20)
    ctx.strokeStyle = c[1]
    ctx.stroke()
  },
  statue: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.15, h * 0.15, w * 0.7, h * 0.7)
    ctx.fillStyle = c[0]
    circle(ctx, w / 2, h * 0.36, w * 0.13)
    ctx.fill()
    rr(ctx, w * 0.3, h * 0.48, w * 0.4, h * 0.3, w * 0.08)
    ctx.fill()
  },
  campfire: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[0]
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      circle(ctx, w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a) * h * 0.3, w * 0.08)
      ctx.fill()
    }
    ctx.fillStyle = c[1]
    circle(ctx, w / 2, h / 2, w * 0.2)
    ctx.fill()
    ctx.fillStyle = c[2]
    circle(ctx, w / 2, h / 2, w * 0.1)
    ctx.fill()
  },
  cart: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[2]
    ctx.fillRect(w * 0.18, h * 0.08, w * 0.1, h * 0.84)
    ctx.fillRect(w * 0.62, h * 0.08, w * 0.1, h * 0.84)
    ctx.fillStyle = c[0]
    ctx.fillRect(w * 0.08, h * 0.18, w * 0.74, h * 0.64)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(2, h / 15)
    ctx.strokeRect(w * 0.08, h * 0.18, w * 0.74, h * 0.64)
    ctx.beginPath()
    ctx.moveTo(w * 0.82, h * 0.4)
    ctx.lineTo(w * 0.98, h * 0.4)
    ctx.moveTo(w * 0.82, h * 0.6)
    ctx.lineTo(w * 0.98, h * 0.6)
    ctx.stroke()
  },
  boulder: (ctx, w, h, rnd, c) => {
    ctx.fillStyle = c[0]
    ctx.beginPath()
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const r = w * (0.34 + rnd() * 0.1)
      const x = w / 2 + Math.cos(a) * r
      const y = h / 2 + Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(2, w / 25)
    ctx.stroke()
    ctx.fillStyle = c[2]
    circle(ctx, w * 0.4, h * 0.38, w * 0.08)
    ctx.fill()
  },
  tent: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(w * 0.08, h * 0.08, w * 0.42, h * 0.84)
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.5, h * 0.08, w * 0.42, h * 0.84)
    ctx.strokeStyle = c[2]
    ctx.lineWidth = Math.max(2, w / 40)
    ctx.strokeRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84)
    ctx.beginPath()
    ctx.moveTo(w * 0.5, h * 0.08)
    ctx.lineTo(w * 0.5, h * 0.92)
    ctx.stroke()
  },
  chest: (ctx, w, h, _r, c) => {
    rr(ctx, w * 0.15, h * 0.25, w * 0.7, h * 0.5, w * 0.05)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.15, h * 0.42, w * 0.7, h * 0.08)
    ctx.fillRect(w * 0.46, h * 0.38, w * 0.08, h * 0.16)
  },
  altar: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[1]
    ctx.fillRect(w * 0.04, h * 0.15, w * 0.92, h * 0.7)
    ctx.fillStyle = c[0]
    ctx.fillRect(w * 0.08, h * 0.22, w * 0.84, h * 0.56)
    ctx.fillStyle = c[2]
    circle(ctx, w / 2, h / 2, h * 0.14)
    ctx.fill()
  },
  trapdoor: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(w * 0.15, h * 0.15, w * 0.7, h * 0.7)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(2, w / 25)
    ctx.strokeRect(w * 0.15, h * 0.15, w * 0.7, h * 0.7)
    ctx.beginPath()
    ctx.moveTo(w / 2, h * 0.15)
    ctx.lineTo(w / 2, h * 0.85)
    ctx.stroke()
    ctx.fillStyle = c[2]
    circle(ctx, w * 0.6, h / 2, w * 0.05)
    ctx.fill()
  },
  roof: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(2, h / 40)
    const rows = 8
    for (let i = 1; i < rows; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (i * h) / rows)
      ctx.lineTo(w, (i * h) / rows)
      ctx.stroke()
    }
    ctx.lineWidth = Math.max(3, h / 20)
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    ctx.strokeRect(0, 0, w, h)
    // Hanging sign marks the tavern.
    ctx.fillStyle = c[2]
    rr(ctx, w * 0.42, h * 0.82, w * 0.16, h * 0.14, h * 0.03)
    ctx.fill()
  },
  counter: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(0, h * 0.2, w, h * 0.6)
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(2, h / 15)
    ctx.strokeRect(0, h * 0.2, w, h * 0.6)
    ctx.fillStyle = c[2]
    circle(ctx, w * 0.2, h / 2, h * 0.1)
    ctx.fill()
    ctx.fillRect(w * 0.65, h * 0.38, w * 0.12, h * 0.24)
  },
  stall: (ctx, w, h, _r, c) => {
    const stripes = 6
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? c[1] : c[0]
      ctx.fillRect((i * w) / stripes, 0, w / stripes, h * 0.6)
    }
    ctx.fillStyle = c[2]
    ctx.fillRect(w * 0.05, h * 0.6, w * 0.9, h * 0.3)
  },
  well: (ctx, w, h, _r, c) => {
    circle(ctx, w / 2, h / 2, w * 0.42)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.strokeStyle = c[1]
    ctx.lineWidth = Math.max(2, w / 20)
    ctx.stroke()
    circle(ctx, w / 2, h / 2, w * 0.26)
    ctx.fillStyle = c[2]
    ctx.fill()
  },
  fence: (ctx, w, h, _r, c) => {
    ctx.fillStyle = c[0]
    ctx.fillRect(0, h * 0.42, w, h * 0.06)
    ctx.fillRect(0, h * 0.54, w, h * 0.06)
    ctx.fillStyle = c[1]
    for (const x of [0.1, 0.5, 0.9]) ctx.fillRect(w * x - w * 0.05, h * 0.36, w * 0.1, h * 0.3)
  },
  token: (ctx, w, h, _r, c) => {
    circle(ctx, w / 2, h / 2, Math.min(w, h) * 0.42)
    ctx.fillStyle = c[0]
    ctx.fill()
    ctx.lineWidth = Math.max(2, w / 18)
    ctx.strokeStyle = c[1]
    ctx.stroke()
  },
}

export const PATTERN_NAMES = [...Object.keys(terrain), ...Object.keys(props)]

export function drawPattern(
  ctx: Ctx,
  pattern: string,
  w: number,
  h: number,
  rnd: () => number,
  colors: string[],
): void {
  const fn = terrain[pattern] ?? props[pattern] ?? terrain.missing
  ctx.save()
  fn(ctx, w, h, rnd, colors)
  ctx.restore()
}
