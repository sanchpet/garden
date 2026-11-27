import type { Point } from "./bookcase/geometry"
import { blob, outline, seeded, wobble } from "./hand"

// The cursor's drawings, baked at build time from a seed like every stroke on the site.
// Each form puts the point it acts at, its hotspot, at a fixed spot of its own box.

export const SEED = 0x5eed
export const PENCIL = "var(--darkgray)"
// The page's ground, drawn wider under a stroke so the cursor stays legible over text.
const HALO = "var(--light)"
// DESIGN.md tokens: paper-cream, ink, steel-blue. Not imported from bookcase.tsx, which pulls
// the page scripts in and so cannot load under the test runner.
const CREAM = "#F5ECDC"
const INK = "#1B1A1C"
const STEEL = "#1E3959"
const STEEL_CONTOUR = "#0E1C2E"

export interface Form {
  svg: string
  // Where the pointer is, in the form's own pixels.
  hotspot: Point
}

const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k]

function svg(size: number, body: string, shown = size): string {
  return `<svg viewBox="0 0 ${size} ${size}" width="${shown}" height="${shown}" aria-hidden="true" focusable="false">${body}</svg>`
}

function path(d: string, stroke: string, width: number, fill = "none"): string {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
}

// The same strokes twice: a wide one in the page's colour, then the drawing itself.
function haloed(parts: Array<[string, string]>, width: number): string {
  const under = parts.map(([d]) => path(d, HALO, width + 2.6, "none")).join("")
  const over = parts.map(([d, fill]) => path(d, PENCIL, width, fill)).join("")
  return under + over
}

// A pencil held at 45° as a right hand holds it to write, point down and to the left:
// graphite, the sharpened wood, the body.
function pencil(rnd: () => number): Form {
  const tip: Point = [2.5, 29.5]
  const u: Point = [Math.SQRT1_2, -Math.SQRT1_2]
  const n: Point = [Math.SQRT1_2, Math.SQRT1_2]
  const cone = add(tip, u, 9)
  const end = add(cone, u, 17)
  const w = 3.6
  const lead = add(tip, u, 3.6)
  const wood: Point[] = [tip, add(cone, n, w), add(cone, n, -w)]
  const body: Point[] = [add(cone, n, w), add(end, n, w), add(end, n, -w), add(cone, n, -w)]
  const ferrule = add(end, u, -3.4)
  const amp = 0.35
  const strokes: Array<[string, string]> = [
    [outline(rnd, body, amp), HALO],
    [outline(rnd, wood, amp), HALO],
    [outline(rnd, [tip, add(lead, n, 1.4), add(lead, n, -1.4)], 0.15), PENCIL],
    [wobble(rnd, add(ferrule, n, w), add(ferrule, n, -w), amp), "none"],
    [wobble(rnd, add(cone, u, 1.2), add(end, u, -4.6), amp), "none"],
  ]
  // Drawn on a 32 grid and shown at 24 px, with the stroke thickened so the line keeps its weight.
  const shown = 24
  const k = shown / 32
  return { svg: svg(32, haloed(strokes, 1.4 / k), shown), hotspot: [tip[0] * k, tip[1] * k] }
}

// A felt marker for drawn objects that are links: a paper barrel, the colour in the nib and
// the cap's ring. A marker keeps its colours in either theme.
function marker(rnd: () => number): Form {
  const tip: Point = [2.5, 2.5]
  const u: Point = [Math.SQRT1_2, Math.SQRT1_2]
  const n: Point = [-Math.SQRT1_2, Math.SQRT1_2]
  const nib = add(tip, u, 6)
  const collar = add(nib, u, 4)
  const end = add(collar, u, 18)
  const amp = 0.35
  const shape = (points: Point[], fill: string, stroke: string) =>
    path(outline(rnd, points, amp), stroke, 1.3, fill)
  const nibShape: Point[] = [
    add(tip, n, 0.8),
    add(nib, n, 2.4),
    add(nib, n, -2.4),
    add(tip, n, -1.2),
  ]
  const collarShape: Point[] = [
    add(nib, n, 3.4),
    add(collar, n, 4.4),
    add(collar, n, -4.4),
    add(nib, n, -3.4),
  ]
  const barrel: Point[] = [
    add(collar, n, 4.4),
    add(end, n, 4.4),
    add(end, n, -4.4),
    add(collar, n, -4.4),
  ]
  const ring = add(end, u, -4)
  const body =
    shape(barrel, CREAM, INK) +
    path(wobble(rnd, add(ring, n, 4.4), add(ring, n, -4.4), amp), STEEL, 2.2) +
    shape(collarShape, STEEL, STEEL_CONTOUR) +
    shape(nibShape, STEEL, STEEL_CONTOUR)
  return { svg: svg(34, body), hotspot: tip }
}

// A scope's crosshair, for the radar: four ticks with the centre left open.
function crosshair(rnd: () => number): Form {
  const c: Point = [16, 16]
  const ticks: Array<[string, string]> = [
    [wobble(rnd, [c[0], 2], [c[0], c[1] - 4.5], 0.4), "none"],
    [wobble(rnd, [c[0], c[1] + 4.5], [c[0], 30], 0.4), "none"],
    [wobble(rnd, [2, c[1]], [c[0] - 4.5, c[1]], 0.4), "none"],
    [wobble(rnd, [c[0] + 4.5, c[1]], [30, c[1]], 0.4), "none"],
    [blob(ring(rnd, c, 1.3, 6)), PENCIL],
  ]
  return { svg: svg(32, haloed(ticks, 1.3)), hotspot: c }
}

// A handwritten question mark beside a footnote mark, which the note answers. It stands up
// and to the right of the pencil's point, so the mark itself stays readable.
function question(rnd: () => number): Form {
  const point: Point = [3, 25]
  const text = `<text x="17" y="21" text-anchor="middle" font-family="Caveat, cursive" font-weight="700" font-size="24" fill="${PENCIL}" stroke="${HALO}" stroke-width="3" paint-order="stroke" stroke-linejoin="round">?</text>`
  const dot = path(blob(ring(rnd, point, 1.6, 6)), HALO, 1.4, PENCIL)
  return { svg: svg(28, text + dot), hotspot: point }
}

// What the pencil shrinks to while brackets frame a block: its point.
function dot(rnd: () => number): Form {
  const c: Point = [6, 6]
  return {
    svg: svg(12, path(blob(ring(rnd, c, 2, 7)), HALO, 1.6, PENCIL)),
    hotspot: c,
  }
}

function ring(rnd: () => number, c: Point, r: number, count: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    const k = r * (0.9 + rnd() * 0.2)
    return [c[0] + Math.cos(a) * k, c[1] + Math.sin(a) * k] as Point
  })
}

// A bracket for each corner, drawn separately so no two match. The box's corner is at 0 0.
function corners(rnd: () => number): string[] {
  const box = 13
  return [0, 1, 2, 3].map(() => {
    const [across, down] = [9 + rnd() * 2, 9 + rnd() * 2]
    const d =
      wobble(rnd, [across, 0.4], [0.4, 0.4], 0.6) + wobble(rnd, [0.4, 0.4], [0.4, down], 0.6, false)
    return `<svg viewBox="-1.5 -1.5 ${box} ${box}" width="${box}" height="${box}" aria-hidden="true" focusable="false">${path(d, PENCIL, 1.5)}</svg>`
  })
}

// The pen line under a link, stretched to each line the link occupies.
function underline(rnd: () => number): string {
  const d =
    wobble(rnd, [0.5, 3], [33, 3.4], 0.9) +
    wobble(rnd, [33, 3.4], [66, 2.7], 0.9, false) +
    wobble(rnd, [66, 2.7], [99.5, 3.1], 0.9, false)
  return `<svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`
}

export interface CursorForms {
  pencil: Form
  marker: Form
  crosshair: Form
  help: Form
  dot: Form
  corners: string[]
  underline: string
}

export function cursorForms(seed = SEED): CursorForms {
  const rnd = seeded(seed)
  return {
    pencil: pencil(rnd),
    marker: marker(rnd),
    crosshair: crosshair(rnd),
    help: question(rnd),
    dot: dot(rnd),
    corners: corners(rnd),
    underline: underline(rnd),
  }
}
