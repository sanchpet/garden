import { blob, f, outline as closedStroke, seeded, wobble } from "../hand"
import { fallbackSpine, hashPath, spineInk, type Point } from "../bookcase/geometry"
import { fit, lineHeight, outline, widthOf, wrap, type Face } from "./type"

// Link preview cards drawn from a page's content (1200×630, the size preview services expect).
// The ground and the mark are those of the site-wide card (brand/src/gen_og.py); what stands
// on it is the page: a text's title, a book with its cover, a tool's dot on the radar scope.
export const WIDTH = 1200
export const HEIGHT = 630
const MARGIN = 80
const RIGHT = WIDTH - MARGIN

const GROUND = "#1E3959"
const CREAM = "#F5ECDC"
const CHALK = "#D3D9E2"
const HAND = "#9DBADB"
const MARKER = "#EC0E16"
const CONTOUR = "#5E0611"
const EDGE = "#EFE6D4"
const DEEP = "#0F2036"

export type Image = { href: string; width: number; height: number }

type Common = {
  // The mark, as a data URI: librsvg does not run the filters of valve.svg the way a browser does.
  mark: string
  label: string
  title: string
  description?: string
  foot?: string
}
export type Card =
  | (Common & { kind: "text" })
  | (Common & { kind: "source"; path: string; author?: string; cover?: Image })
  | (Common & { kind: "tool"; path: string; ring: number })

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

const set = (text: string, face: Face, size: number, x: number, y: number, fill: string) =>
  `<path d="${outline(text, face, size, x, y)}" fill="${fill}"/>`

const pencil = (d: string, width = 2.4, opacity = 0.85) =>
  `<path d="${d}" fill="none" stroke="${CREAM}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`

function ring(rnd: () => number, at: Point, r: number, amp: number): string {
  const n = Math.max(9, Math.round(r / 9))
  const turn = rnd() * Math.PI
  return blob(
    Array.from({ length: n }, (_, i): Point => {
      const a = turn + (i / n) * 2 * Math.PI
      const rr = r + (rnd() * 2 - 1) * amp
      return [at[0] + rr * Math.cos(a), at[1] + rr * Math.sin(a)]
    }),
  )
}

// The title, a pencil line under it, then what the page says about itself. Returns the markup.
function column(card: Card, x: number, width: number, sizes: [number, number][], top: number) {
  let title = fit(card.title, "title", [sizes[0][0]], width, sizes[0][1])
  for (const [size, lines] of sizes) {
    title = fit(card.title, "title", [size], width, lines)
    if (wrap(card.title, "title", size, width, lines + 1).length <= lines) break
  }
  const out: string[] = []
  let y = top
  for (const line of title.lines) {
    y += lineHeight("title", title.size)
    out.push(set(line, "title", title.size, x, y, CREAM))
  }
  const author = card.kind === "source" ? card.author : undefined
  if (author) {
    y += 50
    out.push(set(wrap(author, "italic", 36, width, 1)[0], "italic", 36, x, y, CREAM))
  }
  y += 30
  const longest = Math.max(...title.lines.map((l) => widthOf(l, "title", title.size)))
  const rnd = seeded(hashPath(card.title))
  out.push(pencil(wobble(rnd, [x, y], [x + Math.min(width, longest), y + 1], 2.2), 3, 0.55))
  if (card.description) {
    const size = width > 800 ? 36 : 31
    const room = Math.floor(((card.foot ? 478 : 522) - y) / lineHeight("italic", size))
    y += 22
    for (const line of wrap(card.description, "italic", size, width, Math.min(3, room))) {
      y += lineHeight("italic", size)
      out.push(set(line, "italic", size, x, y, CHALK))
    }
  }
  return out.join("")
}

const OBJECT = { x: MARGIN, y: 150, w: 280, h: 400 }

// A book standing face on: its cover, or a marker-coloured one with the title written on it.
function book(card: Extract<Card, { kind: "source" }>): string {
  const rnd = seeded(hashPath(card.path))
  const { x, y } = OBJECT
  let [w, h] = [OBJECT.w - 12, OBJECT.h]
  let face: string
  if (card.cover) {
    const scale = Math.min(w / card.cover.width, h / card.cover.height)
    ;[w, h] = [card.cover.width * scale, card.cover.height * scale]
    face = `<image href="${card.cover.href}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="none"/>`
  } else {
    const colour = fallbackSpine(card.path)
    const ink = spineInk(colour)
    const written = fit(card.title, "hand", [46, 40, 34, 28], w - 48, 6)
    face =
      `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${colour}"/>` +
      written.lines
        .map((l, i) => set(l, "hand", written.size, x + 24, y + 70 + i * written.size * 1.05, ink))
        .join("") +
      `<path d="${wobble(rnd, [x + 24, y + h - 44], [x + w - 24, y + h - 44], 1.6)}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>`
  }
  const pages = 12
  const block: Point[] = [
    [x + w, y + 5],
    [x + w + pages, y + 9],
    [x + w + pages, y + h - 3],
    [x + w, y + h],
  ]
  const leaves = [3, 6, 9]
    .map(
      (dx) =>
        `<path d="${wobble(rnd, [x + w + dx, y + 8], [x + w + dx, y + h - 3], 0.6)}" fill="none" stroke="#B9AE97" stroke-width="0.9"/>`,
    )
    .join("")
  const cover: Point[] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
  return (
    `<path d="${closedStroke(rnd, block, 0.8)}" fill="${EDGE}"/>${leaves}` +
    face +
    `<path d="${closedStroke(rnd, [...cover.slice(0, 2), block[1], block[2], ...cover.slice(2)], 1.4)}" fill="none" stroke="${DEEP}" stroke-width="3" stroke-linejoin="round"/>`
  )
}

// The radar scope with this tool's dot in its ring; ring 0 is the innermost.
function scope(card: Extract<Card, { kind: "tool" }>): string {
  const R = 200
  const at: Point = [MARGIN + R, 350]
  const edges = [18, 86, 132, 170, R]
  const rnd = seeded(hashPath("radar"))
  const circle = (r: number) =>
    `M${f(at[0] - r)} ${f(at[1])}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
  const [inner, outer] = [edges[card.ring], edges[card.ring + 1]]
  const band = `<path d="${circle(outer)}${circle(inner)}" fill="${CREAM}" fill-rule="evenodd" opacity="0.13"/>`
  const rings = edges
    .slice(1)
    .map((r, i) =>
      pencil(ring(rnd, at, r, i === 3 ? 1.6 : 1.2), i === 3 ? 3 : 2, i === 3 ? 0.9 : 0.6),
    )
    .join("")
  const spokes = [0, 90]
    .map((deg) => {
      const [c, s] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)]
      return pencil(
        wobble(rnd, [at[0] - R * c, at[1] - R * s], [at[0] + R * c, at[1] + R * s], 1.4),
        1.6,
        0.4,
      )
    })
    .join("")
  const knob =
    `<path d="${ring(rnd, at, 15, 0.8)}" fill="${GROUND}" stroke="${CREAM}" stroke-width="2.4"/>` +
    `<circle cx="${at[0]}" cy="${at[1]}" r="4" fill="${CREAM}"/>`
  // The path decides where the dot lands, so a tool keeps its place from build to build.
  const own = seeded(hashPath(card.path))
  const angle = ((20 + own() * 50 + Math.floor(own() * 4) * 90) * Math.PI) / 180
  const r = (inner + outer) / 2
  const dot: Point = [at[0] + r * Math.cos(angle), at[1] - r * Math.sin(angle)]
  const blip =
    `<path d="${ring(own, dot, 15, 1.4)}" fill="${MARKER}" stroke="${CONTOUR}" stroke-width="3"/>` +
    `<path d="M${f(dot[0] - 7)} ${f(dot[1] - 5)}q4 -5 9 -4" fill="none" stroke="#FFD9D3" stroke-width="2.4" stroke-linecap="round" opacity="0.85"/>`
  return band + spokes + rings + knob + blip
}

export function drawCard(card: Card): string {
  const label = set(card.label, "hand", 46, MARGIN + 88, 103, HAND)
  const site = "sanch.pet"
  const foot =
    set(site, "hand", 36, RIGHT - widthOf(site, "hand", 36), 578, HAND) +
    (card.foot ? set(card.foot, "hand", 36, MARGIN, 578, HAND) : "")
  const body =
    card.kind === "text"
      ? column(
          card,
          MARGIN,
          RIGHT - MARGIN,
          [
            [78, 2],
            [66, 2],
            [56, 3],
            [48, 3],
          ],
          150,
        )
      : card.kind === "source"
        ? book(card) +
          column(
            card,
            424,
            RIGHT - 424,
            [
              [62, 2],
              [52, 3],
              [44, 3],
            ],
            150,
          )
        : scope(card) +
          column(
            card,
            548,
            RIGHT - 548,
            [
              [62, 2],
              [52, 3],
              [44, 3],
            ],
            170,
          )
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<title>${esc(card.title)}</title>` +
    `<defs><radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#25456B"/><stop offset="1" stop-color="${GROUND}"/></radialGradient></defs>` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>` +
    `<image href="${card.mark}" x="${MARGIN - 4}" y="52" width="72" height="72"/>` +
    label +
    body +
    foot +
    `</svg>`
  )
}
