import { hashPath, type Point } from "./bookcase/geometry"
import { seeded } from "./hand"

// The scope's geometry and where a tool's dot lands on it. Pure, so the placement is tested
// apart from the drawing.

export const RINGS = ["adopt", "trial", "assess", "hold"] as const
export type Ring = (typeof RINGS)[number]

export const W = 720
export const CX = W / 2
export const R = 270
export const BEZEL = 30
export const CY = 26 + BEZEL + R

// Where each ring ends, from the hub outwards; the first begins clear of the knob.
export const EDGE: Record<Ring, [number, number]> = {
  adopt: [24, 114],
  trial: [114, 174],
  assess: [174, 224],
  hold: [224, R],
}
export const DOT = 11
// Centres closer than this make two dots touch; their numbers then collide too.
export const CLEAR = DOT * 2 + 4

export const polar = (r: number, deg: number): Point => {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)]
}

export interface Seat {
  path: string
  ring: Ring
  // The sector's edges in degrees, counter-clockwise from three o'clock: `from` > `to`.
  from: number
  to: number
}

export interface Placed {
  at: Point
  deg: number
  r: number
}

// The band a dot's centre may take in its cell: clear of the ring edges and the spokes.
function cell(seat: Seat) {
  const [r0, r1] = EDGE[seat.ring]
  const rMin = r0 + DOT + 5
  const rMax = Math.max(rMin, r1 - DOT - 5)
  const span = seat.from - seat.to
  const margin = (r: number) => Math.min(span / 2 - 1, (Math.asin((DOT + 7) / r) * 180) / Math.PI)
  return { rMin, rMax, margin }
}

function clamp(seat: Seat, r: number, deg: number): [number, number] {
  const { rMin, rMax, margin } = cell(seat)
  const rr = Math.min(rMax, Math.max(rMin, r))
  const m = margin(rr)
  return [rr, Math.min(seat.from - m, Math.max(seat.to + m, deg))]
}

const toPolar = ([x, y]: Point): [number, number] => {
  const r = Math.hypot(x - CX, y - CY)
  const deg = (Math.atan2(CY - y, x - CX) * 180) / Math.PI
  return [r, deg]
}

// Same angle range as the seat's edges, which may run below zero or past 360.
const near = (deg: number, seat: Seat) => {
  const mid = (seat.from + seat.to) / 2
  while (deg - mid > 180) deg -= 360
  while (mid - deg > 180) deg += 360
  return deg
}

// Each dot first takes the roomiest of its seeded tries, then crowded dots push each other
// apart inside their cells. The path seeds the tries and fixes the order, so an unchanged
// radar draws the same picture on every build.
export function place(seats: Seat[]): Map<string, Placed> {
  const order = [...seats].sort((a, b) => a.path.localeCompare(b.path))
  const crowd = new Map<string, number>()
  for (const s of order) {
    const key = `${s.ring}|${s.from}`
    crowd.set(key, (crowd.get(key) ?? 0) + 1)
  }

  const at: Point[] = []
  for (const seat of order) {
    const rnd = seeded(hashPath(seat.path))
    const { rMin, rMax, margin } = cell(seat)
    const tries = Math.max(40, 12 * (crowd.get(`${seat.ring}|${seat.from}`) ?? 1))
    let best: { p: Point; room: number } | undefined
    for (let i = 0; i < tries; i++) {
      const r = rMin + rnd() * (rMax - rMin)
      const m = margin(r)
      const deg = seat.to + m + rnd() * (seat.from - seat.to - 2 * m)
      const p = polar(r, deg)
      const room = Math.min(...at.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])), 999)
      if (!best || room > best.room) best = { p, room }
      if (room >= CLEAR + 2) break
    }
    at.push(best!.p)
  }

  // Relaxation: overlapping pairs step apart along the line between them, then each dot is
  // put back inside its cell. A fixed number of passes keeps it deterministic and cheap.
  for (let pass = 0; pass < 200; pass++) {
    let moved = false
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const dx = at[j][0] - at[i][0]
        const dy = at[j][1] - at[i][1]
        const d = Math.hypot(dx, dy)
        if (d >= CLEAR) continue
        moved = true
        // Coincident dots part along a direction their paths fix.
        const [ux, uy] = d > 1e-6 ? [dx / d, dy / d] : [Math.cos(i + j), Math.sin(i + j)]
        const push = (CLEAR - d) / 2 + 0.5
        at[i] = [at[i][0] - ux * push, at[i][1] - uy * push]
        at[j] = [at[j][0] + ux * push, at[j][1] + uy * push]
      }
    }
    for (let i = 0; i < order.length; i++) {
      const [r, deg] = toPolar(at[i])
      const [rr, dd] = clamp(order[i], r, near(deg, order[i]))
      at[i] = polar(rr, dd)
    }
    if (!moved) break
  }

  const out = new Map<string, Placed>()
  order.forEach((seat, i) => {
    const [r, deg] = toPolar(at[i])
    out.set(seat.path, { at: at[i], r, deg: near(deg, seat) })
  })
  return out
}

// How many pairs of dots still touch; zero is the aim.
export function overlaps(placed: Iterable<Placed>): number {
  const pts = [...placed].map((p) => p.at)
  let n = 0
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < DOT * 2) n++
  return n
}

// A frontmatter date arrives as a Date or as the string it was written with.
export function dateOf(value: unknown): Date | undefined {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
        ? new Date(`${value.slice(0, 10)}T00:00:00Z`)
        : undefined
  return date && !Number.isNaN(date.getTime()) ? date : undefined
}

// A tool is new for a quarter after it took its ring, and its place fades once a year has
// passed without the author looking at it again. The site rebuilds daily so the marks move.
export const NEW_DAYS = 90
export const FADED_DAYS = 365
export type Age = "new" | "faded"

export function ageOf(since: unknown, now: Date): Age | undefined {
  const date = dateOf(since)
  if (!date) return undefined
  const days = (now.getTime() - date.getTime()) / 86_400_000
  if (days < 0) return undefined
  if (days < NEW_DAYS) return "new"
  if (days >= FADED_DAYS) return "faded"
  return undefined
}
