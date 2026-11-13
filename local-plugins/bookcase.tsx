import { viewRegistry, type BasesEntry } from "@quartz-community/bases-page"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { FullSlug, resolveRelative } from "../quartz/util/path"
import { languageOf } from "./bilingual"
import { coverName } from "./cover"
import { CASE, hashPath, packShelves, type Point, type ShelfGroup } from "./bookcase/geometry"
// @ts-ignore
import script from "./bookcase.inline"

// A Bases view, `type: bookcase`: the query result as one bookcase drawn in parallel
// projection, a shelf run per `groupBy` value. The book sizes and the shelf packing are
// aarnphm's (bookcase/geometry.ts); the hand is
// the valve logo's (brand/src/gen_icon.py): seeded wobbly strokes and a dark contour, baked
// into the paths so the drawing stays sharp at any zoom. The case is pencil, the books are
// marker, and a book not yet read stays a pencil outline.

export const PALETTE = [
  "#1E3959",
  "#2F5D50",
  "#B8553A",
  "#D9A441",
  "#5B3A5E",
  "#84A59D",
  "#284B63",
  "#8C2F39",
]
export const CREAM = "#F5ECDC"
const PAGES = "#EFE6D4"
export const INK = "#1B1A1C"
export const MARK = "#EC0E16"
export const BURGUNDY = "#5E0611"
// A book not yet begun still wears the publisher's paper band, with the shop's price sticker.
export const WRAP = {
  paper: "#F3EAD8",
  side: "#DED2BA",
  edge: "#6B6252",
  tag: "#F2B705",
  ink: "#8A6500",
}
export const HEX = /^#[0-9a-f]{6}$/i
export const PENCIL = "var(--darkgray)"
export const PAPER = "var(--light)"
const MIN_SHELVES = 3
const ROWS = 5
// A pulled book clears the case and its label tags, so the scene keeps this much room around it.
const MARGIN = { left: 120, right: 30, top: 30, bottom: 90 }

// World axes as in geometry.ts: +x along the shelf, +y away from the viewer, +z up. The case
// is turned towards the reader more than an isometric one: the shelf runs at 18° and the depth
// is foreshortened, so spines and shelf tags face the page.
const AXIS_X: Point = [0.951, 0.309]
const AXIS_Y: Point = [0.508, -0.356]

function project(x: number, y: number, z: number): Point {
  return [x * AXIS_X[0] + y * AXIS_Y[0], x * AXIS_X[1] + y * AXIS_Y[1] - z]
}

// The three faces a viewer sees of a box, and its silhouette.
function box(x: number, y: number, z: number, w: number, d: number, h: number) {
  const [A, B, C] = [project(x, y, z), project(x + w, y, z), project(x + w, y + d, z)]
  const [D, E] = [project(x + w, y + d, z + h), project(x, y + d, z + h)]
  const [F, N] = [project(x, y, z + h), project(x + w, y, z + h)]
  return { front: [A, B, N, F], side: [B, C, D, N], top: [F, N, D, E], edge: [A, B, C, D, E, F] }
}

export const STATUS = {
  ru: { later: "в очереди", "in-progress": "читаю", done: "прочитано" },
  en: { later: "to read", "in-progress": "reading", done: "read" },
} as const
export type Language = keyof typeof STATUS

const UI = {
  ru: {
    all: "все",
    open: "Заметки по книге",
    turn: "можно повертеть",
    close: "Вернуть на полку",
    zoomIn: "Приблизить",
    zoomOut: "Отдалить",
    fit: "Весь шкаф",
    full: "На весь экран",
    sections: "Разделы",
  },
  en: {
    all: "all",
    open: "Notes on the book",
    turn: "drag to turn",
    close: "Put it back",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fit: "Whole bookcase",
    full: "Full screen",
    sections: "Sections",
  },
}

export const FONT_FACE = `
@font-face {
  font-family: "Caveat";
  src: url("/static/caveat.woff2") format("woff2");
  font-weight: 400 700;
  font-display: swap;
}`

export function statusLabel(lang: Language, status: unknown): string | undefined {
  const words: Record<string, string> = STATUS[lang]
  return typeof status === "string" && Object.hasOwn(words, status) ? words[status] : undefined
}

// A property as a reader would see it: the first of a list, a wikilink by its name.
export function plain(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first !== "string" && typeof first !== "number") return ""
  const text = String(first).trim()
  const link = /^\[\[([^\]|]*)(?:\|([^\]]*))?\]\]$/.exec(text)
  return link ? (link[2] ?? link[1].split("/").pop()!).trim() : text
}

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

export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function darken(hex: string, by: number): string {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - by))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  )
}

// Caveat's advance by kind of glyph, in em, measured on the bold cut and rounded up.
export function inkWidth(text: string, size: number): number {
  let em = 0
  for (const ch of text) {
    if (ch === " ") em += 0.24
    else if (/[A-ZА-ЯЁ]/.test(ch)) em += 0.6
    else if (/[а-яёmw]/.test(ch)) em += 0.48
    else em += 0.36
  }
  return em * size
}

// A text too long for its room is first written smaller, then cut.
export function lettering(
  text: string,
  size: number,
  room: number,
  floor = 0.66,
): { text: string; size: number } {
  const natural = inkWidth(text, size)
  if (natural <= room) return { text, size }
  const smaller = Math.max(size * floor, (size * room) / natural)
  if (smaller > size * floor) return { text, size: smaller }
  let cut = text
  while (cut.length > 1 && inkWidth(`${cut}…`, smaller) > room) cut = cut.slice(0, -1).trimEnd()
  return { text: cut === text ? text : `${cut.replace(/[\s….,:;—-]+$/, "")}…`, size: smaller }
}

export interface Shelved {
  entry: BasesEntry
  foreign: boolean
}

interface Bounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

const grow = (b: Bounds, points: readonly Point[]) => {
  for (const [x, y] of points) {
    b.x0 = Math.min(b.x0, x)
    b.y0 = Math.min(b.y0, y)
    b.x1 = Math.max(b.x1, x)
    b.y1 = Math.max(b.y1, y)
  }
}
const empty = (): Bounds => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity })
const rect = (b: Bounds) => [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0].map(f).join(",")

const withoutLanguage = (slug: string) =>
  languageOf(slug) ? slug.slice(slug.indexOf("/") + 1) : slug

// A book has one card; where both languages have it, the shelf shows the page's own.
export function ownLanguage(entries: BasesEntry[], lang: Language): Shelved[] {
  const byBook = new Map<string, Shelved>()
  for (const entry of entries) {
    const foreign = languageOf(entry.slug) !== undefined && languageOf(entry.slug) !== lang
    const key = withoutLanguage(entry.slug)
    if (!byBook.has(key) || !foreign) byBook.set(key, { entry, foreign })
  }
  return [...byBook.values()]
}

// Bases sorts the entries by the view's `sort`, so the shelves take their order from the
// group value itself.
export function grouped(
  books: Shelved[],
  property: string | undefined,
  descending: boolean,
): ShelfGroup<Shelved>[] {
  const key = property?.replace(/^note\./, "")
  const groups = new Map<string, Shelved[]>()
  for (const book of books) {
    const name = key ? plain(book.entry.properties[key]) : ""
    groups.set(name, [...(groups.get(name) ?? []), book])
  }
  const named = [...groups].sort(
    ([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)) * (descending ? -1 : 1),
  )
  return named.map(([label, members]) => ({
    label: label || null,
    books: members.map((item) => ({ path: withoutLanguage(item.entry.slug), item })),
  }))
}

function Face({
  d,
  fill,
  stroke,
  width,
  class: className,
}: {
  d: string
  fill: string
  stroke: string
  width: number
  class?: string
}) {
  return (
    <path
      class={className}
      d={d}
      fill={fill}
      stroke={stroke}
      stroke-width={width}
      stroke-linejoin="round"
    />
  )
}

function Solid({
  at,
  seed,
}: {
  at: [number, number, number, number, number, number]
  seed: number
}) {
  const rnd = seeded(seed)
  const solid = box(...at)
  const hatch = Array.from({ length: Math.floor(at[5] / 16) }, (_, i) => {
    const z = at[2] + at[5] - 8 - i * 16 + rnd() * 6
    const y = at[1] + 3 + rnd() * 10
    if (rnd() < 0.35) return ""
    return wobble(
      rnd,
      project(at[0] + at[3], y, z),
      project(at[0] + at[3], y + 7 + rnd() * 5, z + 9 + rnd() * 5),
      0.5,
    )
  }).join("")
  return (
    <g>
      {[solid.side, solid.front, solid.top].map((face) => (
        <Face d={outline(rnd, face, 0.7)} fill={PAPER} stroke={PENCIL} width={1.3} />
      ))}
      {hatch && <path d={hatch} fill="none" stroke={PENCIL} stroke-width="0.8" opacity="0.5" />}
    </g>
  )
}

viewRegistry.register({
  id: "bookcase",
  name: "Bookcase",
  icon: "library",
  render: ({ entries, view, slug, allSlugs }) => {
    const lang: Language = languageOf(slug) ?? "ru"
    const ui = UI[lang]
    const note = typeof view.fallbackNote === "string" ? view.fallbackNote : ""
    const groups = grouped(
      ownLanguage(entries, lang),
      view.groupBy?.property,
      view.groupBy?.direction === "DESC",
    )
    const layout = packShelves(groups)
    const shelves = Math.max(layout.shelves.length, MIN_SHELVES)
    const rows = Math.min(ROWS, shelves)
    const bays = Math.ceil(shelves / rows)
    const inner = layout.shelfWidth + CASE.start
    const height = CASE.plinth + rows * layout.pitch + CASE.board
    const width = CASE.wall + bays * (inner + CASE.wall)
    const bayX = (bay: number) => CASE.wall + bay * (inner + CASE.wall)
    const floor = (shelf: number) =>
      CASE.plinth + CASE.board + (rows - 1 - (shelf % rows)) * layout.pitch
    const scene = empty()
    grow(
      scene,
      box(
        -CASE.overhang,
        -CASE.overhang,
        0,
        width + 2 * CASE.overhang,
        layout.depth + CASE.overhang,
        height + CASE.crown,
      ).edge,
    )
    const sections = groups.map(() => empty())

    const book = (placed: (typeof layout.books)[number]) => {
      const { entry, foreign } = placed.item
      const props = entry.properties
      const id = hashPath(placed.path)
      const rnd = seeded(id)
      const status = typeof props.status === "string" ? props.status : ""
      const wrapped = status === "later"
      const colour =
        typeof props.spine === "string" && HEX.test(props.spine)
          ? props.spine
          : PALETTE[id % PALETTE.length]
      const x = bayX(Math.floor(placed.shelf / rows)) + placed.x
      const [y, z, w, d, h] = [
        placed.setback,
        floor(placed.shelf),
        placed.thickness,
        placed.depth,
        placed.height,
      ]
      const solid = box(x, y, z, w, d, h)
      grow(sections[layout.shelves[placed.shelf].group], solid.edge)
      const contour = darken(colour, 0.55)
      const stroke = 1.6
      const letters = luminance(colour) > 0.55 ? INK : CREAM
      // The band takes the foot of the spine, and the lettering starts above it.
      const wrap = wrapped ? { from: 5, to: 30 } : undefined
      const raised = wrap ? wrap.to - 4 : 0
      const at = (dx: number, dz: number) => project(x + dx, y, z + dz)
      const band = (dz: number) => wobble(rnd, at(2, dz), at(w - 2, dz), 0.4)

      const full = plain(entry.title) || entry.fileProperties.basename
      const title = full.split(": ")[0].trim() || full
      const author = plain(props.author)
      const year = plain(props.year)
      const size = Math.min(15, Math.max(9, w * 0.58))
      const run = h - 34 - raised
      const named = lettering(title, size, author ? run * 0.64 : run)
      // The author gets what the title leaves; a name still too long is signed by its surname.
      const authorSize = size * 0.72
      const authorRoom = run - inkWidth(named.text, named.size) - 10
      const surname = inkWidth(author, authorSize) > authorRoom ? author.split(" ").pop()! : author
      const signed = lettering(surname, authorSize, authorRoom)
      // An English spine reads top to bottom, a Russian one bottom to top.
      const down = languageOf(entry.slug) === "en"
      const turn = down ? [0, 1, -AXIS_X[0], -AXIS_X[1]] : [0, -1, ...AXIS_X]
      const [head, foot] = [at(w / 2, h - 17), at(w / 2, 17 + raised)]
      const matrix = (p: Point) => `matrix(${[...turn, ...p].map(f).join(" ")})`

      const cover = coverName(props.cover)
      const image = cover && allSlugs.find((s) => s === cover || s.endsWith(`/${cover}`))
      const ribbon: Point[] = [
        project(x + w / 2 - 3, y + d * 0.3, z + h - 2),
        project(x + w / 2 + 3, y + d * 0.3, z + h - 2),
        project(x + w / 2 + 3, y + d * 0.3, z + h + 13),
        project(x + w / 2 - 3, y + d * 0.3, z + h + 13),
      ]
      const [B, , D, N] = solid.side
      const sticker = Math.min(w / 2 - 3, 7)

      return (
        <a
          class="bookcase-book"
          href={resolveRelative(slug as FullSlug, entry.slug as FullSlug)}
          data-router-ignore
          data-status={status}
          data-group={layout.shelves[placed.shelf].group}
          data-title={full}
          data-author={author}
          data-year={year}
          data-state={statusLabel(lang, status) ?? ""}
          data-description={plain(props.description)}
          data-cover={image ? resolveRelative(slug as FullSlug, image as FullSlug) : ""}
          data-colour={colour}
          data-ink={letters}
          data-edge={contour}
          data-thick={f(w)}
          data-face={[N, D, B].flat().map(f).join(",")}
          data-note={foreign ? note : ""}
          aria-label={[title, author, year, statusLabel(lang, status)].filter(Boolean).join(", ")}
        >
          <Face
            class="bookcase-cover"
            d={outline(rnd, solid.side, 0.5)}
            fill={darken(colour, 0.22)}
            stroke={contour}
            width={stroke}
          />
          {wrap && (
            <Face
              d={outline(
                rnd,
                [
                  project(x + w, y, z + wrap.from),
                  project(x + w, y + d, z + wrap.from),
                  project(x + w, y + d, z + wrap.to),
                  project(x + w, y, z + wrap.to),
                ],
                0.4,
              )}
              fill={WRAP.side}
              stroke={WRAP.edge}
              width={1}
            />
          )}
          <Face d={outline(rnd, solid.top, 0.4)} fill={PAGES} stroke={contour} width={stroke} />
          {status === "in-progress" && (
            <Face d={outline(rnd, ribbon, 0.3)} fill={MARK} stroke={BURGUNDY} width={1.1} />
          )}
          <Face d={outline(rnd, solid.front, 0.5)} fill={colour} stroke={contour} width={stroke} />
          <path
            d={[0.3, 0.72].map((t) => wobble(rnd, at(w * t, 5), at(w * t, h - 5), 0.9)).join("")}
            fill="none"
            stroke={darken(colour, 0.3)}
            stroke-width={f(w * 0.16)}
            stroke-linecap="round"
            opacity="0.3"
          />
          <path
            d={band(h - 7) + band(h - 10) + (wrap ? "" : band(8))}
            fill="none"
            stroke={letters}
            stroke-width="0.9"
            stroke-linecap="round"
            opacity="0.85"
          />
          {wrap && (
            <Face
              d={outline(
                rnd,
                [
                  at(-0.5, wrap.from),
                  at(w + 0.5, wrap.from),
                  at(w + 0.5, wrap.to),
                  at(-0.5, wrap.to),
                ],
                0.4,
              )}
              fill={WRAP.paper}
              stroke={WRAP.edge}
              width={1}
            />
          )}
          {wrap && (
            <path
              d={blob(
                Array.from({ length: 8 }, (_, i) => {
                  const a = (i * Math.PI) / 4
                  const r = sticker + (rnd() - 0.5)
                  return at(w / 2 + r * Math.cos(a), (wrap.from + wrap.to) / 2 + r * Math.sin(a))
                }),
              )}
              fill={WRAP.tag}
              stroke={WRAP.ink}
              stroke-width="0.8"
            />
          )}
          <text
            class="bookcase-title"
            transform={matrix(down ? head : foot)}
            style={`fill:${letters};font-size:${f(named.size)}px`}
          >
            {named.text}
          </text>
          {signed.text && (
            <text
              class="bookcase-author"
              transform={matrix(down ? foot : head)}
              style={`fill:${letters};font-size:${f(signed.size)}px`}
            >
              {signed.text}
            </text>
          )}
        </a>
      )
    }

    const tag = (shelf: (typeof layout.shelves)[number]) => {
      if (!shelf.label) return null
      const rnd = seeded(hashPath(shelf.label))
      const x = bayX(Math.floor(shelf.index / rows)) + 8
      const z = floor(shelf.index) - CASE.board
      const w = inkWidth(shelf.label, 16) + 14
      const plate: Point[] = [
        project(x, -1, z + 2),
        project(x + w, -1, z + 2),
        project(x + w, -1, z - 20),
        project(x, -1, z - 20),
      ]
      return (
        <g>
          <Face d={outline(rnd, plate, 0.4)} fill={PAPER} stroke={PENCIL} width={1} />
          <text
            class="bookcase-tag"
            transform={`matrix(${[...AXIS_X, 0, 1, ...project(x + 7, -1, z - 9)].map(f).join(" ")})`}
          >
            {shelf.label}
          </text>
        </g>
      )
    }

    const drawn = Array.from({ length: bays }, (_, bay) => {
      const x = bayX(bay)
      const runs = Array.from({ length: rows }, (_, i) => bay * rows + rows - 1 - i)
      return (
        <g>
          <Solid at={[x - CASE.wall, 0, 0, CASE.wall, layout.depth, height]} seed={bay * 97 + 1} />
          <Solid at={[x, 0, 0, inner, layout.depth, CASE.plinth]} seed={bay * 97 + 2} />
          {runs.map((index) => (
            <g>
              <Solid
                at={[x, 0, floor(index) - CASE.board, inner, layout.depth, CASE.board]}
                seed={index * 31 + 5}
              />
              {layout.books.filter((b) => b.shelf === index).map(book)}
            </g>
          ))}
          {runs.map((index) => layout.shelves[index] && tag(layout.shelves[index]))}
        </g>
      )
    })

    const back = seeded(11)
    const panel: Point[] = [
      project(0, layout.depth, 0),
      project(width, layout.depth, 0),
      project(width, layout.depth, height),
      project(0, layout.depth, height),
    ]
    const [vx, vy] = [scene.x0 - MARGIN.left, scene.y0 - MARGIN.top]
    const [vw, vh] = [scene.x1 - vx + MARGIN.right, scene.y1 - vy + MARGIN.bottom]
    const pull = project(0, -(layout.depth + CASE.setback + CASE.pullClear), CASE.lift)
    const tabs = groups.filter((g) => g.label).length > 1

    return (
      <div
        class="bookcase"
        data-open={ui.open}
        data-turn={ui.turn}
        data-close={ui.close}
        style={`--pull-x:${f(pull[0])}px;--pull-y:${f(pull[1])}px`}
      >
        <div class="bookcase-stage">
          <svg
            class="bookcase-scene"
            width={f(vw)}
            height={f(vh)}
            viewBox={[vx, vy, vw, vh].map(f).join(" ")}
            data-fit={rect(scene)}
          >
            <Face d={outline(back, panel, 0.8)} fill={PAPER} stroke={PENCIL} width={1.3} />
            {drawn}
            <Solid at={[width - CASE.wall, 0, 0, CASE.wall, layout.depth, height]} seed={3} />
            <Solid
              at={[
                -CASE.overhang,
                -CASE.overhang,
                height,
                width + 2 * CASE.overhang,
                layout.depth + CASE.overhang,
                CASE.crown,
              ]}
              seed={4}
            />
            <g class="bookcase-lift" aria-hidden="true" />
          </svg>
          <div class="bookcase-controls">
            <button type="button" data-do="in" aria-label={ui.zoomIn} title={ui.zoomIn}>
              +
            </button>
            <button type="button" data-do="out" aria-label={ui.zoomOut} title={ui.zoomOut}>
              −
            </button>
            <button type="button" data-do="fit" aria-label={ui.fit} title={ui.fit}>
              ⤢
            </button>
            <button type="button" data-do="full" aria-label={ui.full} title={ui.full}>
              ⛶
            </button>
          </div>
          {tabs && (
            <div class="bookcase-sections" role="group" aria-label={ui.sections}>
              <button type="button" data-do="fit">
                {ui.all}
              </button>
              {groups.map(
                (group, i) =>
                  group.label && (
                    <button type="button" data-to={rect(sections[i])}>
                      {group.label} <small>{group.books.length}</small>
                    </button>
                  ),
              )}
            </div>
          )}
          <aside class="bookcase-panel" hidden aria-live="polite" />
        </div>
      </div>
    )
  },
  css: `
${FONT_FACE}
.bookcase {
  margin: 1.5rem 0 2rem;
}
/* The catalogue is its folder's index note; the folder listing under it would repeat the shelf. */
article:has(.bookcase) + .page-listing {
  display: none;
}
.bookcase-stage {
  position: relative;
  overflow: auto;
  max-height: min(78vh, 680px);
  border: 1px solid var(--lightgray);
  border-radius: 6px;
}
.bookcase.is-live .bookcase-stage {
  overflow: hidden;
  height: min(84vh, 760px);
  touch-action: pan-y;
  cursor: grab;
}
.bookcase.is-live .bookcase-stage.is-dragging {
  cursor: grabbing;
}
.bookcase.is-full {
  position: fixed;
  inset: 0;
  z-index: 900;
  margin: 0;
  display: flex;
  flex-direction: column;
  background: var(--light);
}
.bookcase.is-full .bookcase-stage {
  flex: 1;
  height: auto;
  max-height: none;
  border: 0;
  touch-action: none;
}
.bookcase-scene {
  display: block;
  transform-origin: 0 0;
}
.bookcase.is-gliding .bookcase-scene {
  transition: transform 0.35s ease;
}
.bookcase-scene text {
  font-family: "Caveat", cursive;
  dominant-baseline: central;
  pointer-events: none;
}
.bookcase-title {
  font-weight: 700;
}
.bookcase-author {
  font-weight: 500;
  text-anchor: end;
}
.bookcase-scene .bookcase-tag {
  font-size: 16px;
  font-weight: 600;
  fill: var(--darkgray);
}
.bookcase-book {
  cursor: pointer;
  outline: none;
}
.bookcase-book:focus-visible > path[stroke-linejoin] {
  stroke: var(--secondary);
  stroke-width: 3;
}
.bookcase-book.is-out {
  visibility: hidden;
}
.bookcase-lift > g {
  transition: transform 0.28s ease-out;
}
.bookcase-lift > g.is-pulled {
  transform: translate(var(--pull-x), var(--pull-y));
}
.bookcase-controls,
.bookcase-sections {
  display: none;
}
.bookcase.is-live .bookcase-controls,
.bookcase.is-live .bookcase-sections {
  position: absolute;
  display: flex;
  gap: 0.3rem;
}
.bookcase-controls {
  top: 0.6rem;
  right: 0.6rem;
  flex-direction: column;
}
.bookcase-sections {
  left: 0.6rem;
  bottom: 0.6rem;
  right: 0.6rem;
  flex-wrap: wrap;
}
.bookcase button {
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.55rem;
  border: 1px solid var(--lightgray);
  border-radius: 4px;
  background: var(--light);
  color: var(--darkgray);
  font-family: "Caveat", cursive;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
}
.bookcase button:hover,
.bookcase button[aria-pressed="true"] {
  border-color: var(--secondary);
  color: var(--secondary);
}
.bookcase button small {
  opacity: 0.6;
}
/* The card of a picked book comes up over the scene, beside the book. */
.bookcase-panel {
  position: absolute;
  right: 0.6rem;
  bottom: 3.3rem;
  z-index: 2;
  display: flex;
  gap: 0.9rem;
  width: min(25rem, calc(100% - 1.2rem));
  max-height: calc(100% - 4.2rem);
  overflow: auto;
  box-sizing: border-box;
  padding: 0.9rem 1rem;
  border: 1px solid var(--lightgray);
  border-radius: 6px;
  background: var(--light);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  cursor: default;
  animation: bookcase-card 0.25s ease-out;
}
@keyframes bookcase-card {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
.bookcase-panel[hidden] {
  display: none;
}
.bookcase-panel h3 {
  margin: 0 1.6rem 0.2rem 0;
  font-size: 1.15rem;
}
.bookcase-panel p {
  margin: 0.25rem 0;
  font-size: 0.92rem;
  line-height: 1.45;
}
.bookcase-panel .bookcase-byline {
  color: var(--gray);
  font-size: 0.85rem;
}
.bookcase-panel .bookcase-note {
  color: var(--gray);
  font-size: 0.82rem;
  font-style: italic;
}
.bookcase-panel > button {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  min-width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border-color: transparent;
}
.bookcase-figure {
  flex: none;
  margin: 0;
  text-align: center;
}
.bookcase-figure figcaption {
  font-family: "Caveat", cursive;
  font-size: 1rem;
  color: var(--gray);
}
/* The picked book as a volume to turn in the hand. */
.bookcase-volume {
  display: grid;
  place-items: center;
  width: 150px;
  height: 200px;
  perspective: 900px;
  touch-action: none;
  cursor: grab;
  outline: none;
}
.bookcase-volume:active {
  cursor: grabbing;
}
.bookcase-volume:focus-visible {
  outline: 2px dashed var(--secondary);
  outline-offset: 2px;
}
.bookcase-volume-body {
  position: relative;
  width: var(--w);
  height: var(--h);
  transform-style: preserve-3d;
  transform: rotateX(var(--rx)) rotateY(var(--ry));
}
/* It turns once on its own as it appears, to show that it can be turned. */
.bookcase-volume-body.is-new {
  animation: bookcase-turn 1.3s ease-in-out;
}
@keyframes bookcase-turn {
  40% {
    transform: rotateX(var(--rx)) rotateY(calc(var(--ry) - 55deg));
  }
}
.bookcase-volume-body > * {
  position: absolute;
  box-sizing: border-box;
  border: 1.5px solid var(--edge);
  background: var(--colour) center / 100% 100% no-repeat;
  backface-visibility: hidden;
}
.bookcase-volume-front,
.bookcase-volume-back {
  inset: 0;
  display: grid;
  place-items: center;
  padding: 0.5rem;
  color: var(--ink);
  font-family: "Caveat", cursive;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.1;
  text-align: center;
  transform: translateZ(calc(var(--t) / 2));
}
.bookcase-volume-back {
  transform: rotateY(180deg) translateZ(calc(var(--t) / 2));
}
.bookcase-volume-spine,
.bookcase-volume-pages {
  top: 0;
  left: calc(50% - var(--t) / 2);
  width: var(--t);
  height: 100%;
}
.bookcase-volume-spine {
  display: grid;
  place-items: center;
  color: var(--ink);
  font-family: "Caveat", cursive;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  writing-mode: vertical-rl;
  transform: rotateY(-90deg) translateZ(calc(var(--w) / 2));
}
.bookcase-volume-pages {
  transform: rotateY(90deg) translateZ(calc(var(--w) / 2));
}
.bookcase-volume-top,
.bookcase-volume-bottom {
  left: 0;
  top: calc(50% - var(--t) / 2);
  width: 100%;
  height: var(--t);
  transform: rotateX(90deg) translateZ(calc(var(--h) / 2));
}
.bookcase-volume-bottom {
  transform: rotateX(-90deg) translateZ(calc(var(--h) / 2));
}
/* The paper band of a book not yet begun goes round the volume, the price sticker on its front. */
.bookcase-volume-body.is-wrapped > :is(.bookcase-volume-front, .bookcase-volume-back, .bookcase-volume-spine, .bookcase-volume-pages)::after {
  content: "";
  position: absolute;
  left: -1.5px;
  right: -1.5px;
  bottom: 8%;
  height: 16%;
  border-block: 1.5px solid ${WRAP.edge};
  background: ${WRAP.paper};
}
.bookcase-volume-body.is-wrapped > .bookcase-volume-front::before {
  content: "";
  position: absolute;
  z-index: 1;
  right: 12%;
  bottom: 10%;
  width: 22%;
  aspect-ratio: 1;
  border: 1.5px solid ${WRAP.ink};
  border-radius: 50%;
  background: ${WRAP.tag};
}
.bookcase-volume-body > :is(.bookcase-volume-pages, .bookcase-volume-top, .bookcase-volume-bottom) {
  background: repeating-linear-gradient(90deg, ${PAGES} 0 2px, #d9cfbb 2px 3px);
}
.bookcase-panel h3 {
  margin: 0 0 0.2rem;
}
.bookcase-panel p {
  margin: 0.25rem 0;
}
.bookcase-panel .bookcase-byline {
  color: var(--gray);
  font-size: 0.9rem;
}
.bookcase-panel .bookcase-note {
  color: var(--gray);
  font-size: 0.85rem;
  font-style: italic;
}
@media (prefers-reduced-motion: reduce) {
  .bookcase.is-gliding .bookcase-scene,
  .bookcase-lift > g {
    transition: none;
  }
  .bookcase-panel,
  .bookcase-volume-body.is-new {
    animation: none;
  }
}
`,
})

// The view's script travels with a header component: a base embedded in a note is rendered
// without the script a view registers.
export const BookcaseScript = (() => {
  const Script: QuartzComponent = () => null
  Script.afterDOMLoaded = script
  return Script
}) satisfies QuartzComponentConstructor
