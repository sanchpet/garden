import type { Point } from "./bookcase/geometry"

// The hand's strokes, shared by every drawing: seeded, so a build repeats itself.
// mulberry32: a drawing must come out the same on every build.
export function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const f = (v: number) => String(Math.round(v * 10) / 10)

// A stroke from a to b that drifts off the straight line by up to `amp`, as a hand does.
export function wobble(rnd: () => number, a: Point, b: Point, amp: number, move = true): string {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const length = Math.hypot(dx, dy) || 1
  const n = Math.max(1, Math.round(length / 70))
  const [nx, ny] = [-dy / length, dx / length]
  const off = () => (rnd() * 2 - 1) * amp
  let d = move ? `M${f(a[0])} ${f(a[1])}` : ""
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const end = i < n ? off() : 0
    const mid = off()
    const tm = t - 0.5 / n
    d += `Q${f(a[0] + dx * tm + nx * mid)} ${f(a[1] + dy * tm + ny * mid)} ${f(a[0] + dx * t + nx * end)} ${f(a[1] + dy * t + ny * end)}`
  }
  return d
}

// A closed, slightly uneven round shape through the given points.
export function blob(points: readonly Point[]): string {
  const mid = (a: Point, b: Point) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(points[points.length - 1], points[0])
  const arcs = points.map((p, i) => {
    const m = mid(p, points[(i + 1) % points.length])
    return `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`
  })
  return `M${f(start[0])} ${f(start[1])}${arcs.join("")}Z`
}

export function outline(rnd: () => number, points: readonly Point[], amp: number): string {
  return (
    points.map((p, i) => wobble(rnd, p, points[(i + 1) % points.length], amp, i === 0)).join("") +
    "Z"
  )
}
