import { viewRegistry } from "@quartz-community/bases-page"
import { FullSlug, resolveRelative } from "../quartz/util/path"
import { languageOf } from "./bilingual"
import {
  BURGUNDY,
  CREAM,
  FONT_FACE,
  HEX,
  INK,
  MARK,
  PALETTE,
  UI,
  WRAP,
  blob,
  darken,
  f,
  grouped,
  inkWidth,
  lettering,
  luminance,
  outline,
  ownLanguage,
  plain,
  seeded,
  shelved,
  statusLabel,
  statusOf,
  withoutLanguage,
  wobble,
  type Language,
  type Shelved,
} from "./bookcase"
import { bookSize, hashPath, type Point } from "./bookcase/geometry"

// A Bases view, `type: shelves`: the same books as the bookcase, face on — spines in rows that
// wrap with the page, a pencil board under each row, and after the shelves the stacks from the
// nightstand: what is being read on what has not been begun. No script: a spine is a link.

const BOOK_BOX = 232 // every book stands in a box this tall, so a wrapped row has a known height
const BOARD = 34
const TILE = 640

// The room a spine takes in a stack, where it lies on its side.
const lyingHeight = (path: string) => Math.round(bookSize(path).thickness * 1.2 + 16) + 8

function Spine({
  book,
  path,
  from,
  lang,
  lying = false,
}: {
  book: Shelved
  path: string
  from: FullSlug
  lang: Language
  lying?: boolean
}) {
  const { entry } = book
  const props = entry.properties
  const id = hashPath(path)
  const rnd = seeded(id)
  const status = typeof props.status === "string" ? props.status : ""
  const wrapped = status === "later"
  const colour =
    typeof props.spine === "string" && HEX.test(props.spine)
      ? props.spine
      : PALETTE[id % PALETTE.length]
  // The same book keeps its proportions in both views.
  const size = bookSize(path)
  const width = Math.round(size.thickness * 1.2 + 16)
  const height = Math.round(size.height * 0.94)
  const tab = status === "in-progress" ? 15 : 0
  const pad = 4
  const [w, h] = [width + pad * 2, height + pad * 2 + tab]
  const [x0, y0, x1, y1] = [pad, pad + tab, pad + width, pad + tab + height]
  const letters = luminance(colour) > 0.55 ? INK : CREAM
  const contour = darken(colour, 0.55)
  // The band takes the foot of the spine, and the lettering starts above it.
  const raised = wrapped ? 24 : 0
  const band = (y: number) => wobble(rnd, [x0 + 3, y], [x1 - 3, y], 0.7)

  const full = plain(entry.title) || entry.fileProperties.basename
  const title = full.split(": ")[0].trim() || full
  const author = plain(props.author)
  const run = height - 44 - raised
  const named = lettering(title, 20, author ? run * 0.62 : run, 0.56)
  const authorRoom = run - inkWidth(named.text, named.size) - 10
  const surname = inkWidth(author, 14) > authorRoom ? author.split(" ").pop()! : author
  const signed = lettering(surname, 14, authorRoom, 0.6)
  // An English spine reads top to bottom, a Russian one bottom to top.
  const turn = languageOf(entry.slug) === "en" ? 90 : -90
  const [cx, top, bottom] = [(x0 + x1) / 2, y0 + 22, y1 - 22 - raised]
  const at = (y: number) => `translate(${f(cx)} ${f(y)}) rotate(${turn})`
  const ribbon: Point[] = [
    [x0 + 9, pad],
    [x0 + 20, pad],
    [x0 + 20, y0 + 6],
    [x0 + 9, y0 + 6],
  ]

  return (
    <a
      class={lying ? "internal shelves-book is-lying" : "internal shelves-book"}
      href={resolveRelative(from, entry.slug as FullSlug)}
      data-slug={entry.slug}
      aria-label={[title, author, plain(props.year), statusLabel(lang, status)]
        .filter(Boolean)
        .join(", ")}
      style={
        lying
          ? `width:${h}px;height:${w}px;--turn:${-turn}deg`
          : `--lean:${f((rnd() * 2 - 1) * 1.2)}deg`
      }
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        {tab > 0 && (
          <path
            d={outline(rnd, ribbon, 0.5)}
            fill={MARK}
            stroke={BURGUNDY}
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        )}
        <path
          d={outline(
            rnd,
            [
              [x0, y0],
              [x1, y0],
              [x1, y1],
              [x0, y1],
            ],
            1.2,
          )}
          fill={colour}
          stroke={contour}
          stroke-width="2.4"
          stroke-linejoin="round"
        />
        <path
          d={[0.24, 0.55, 0.83]
            .map((t) => wobble(rnd, [x0 + width * t, y0 + 5], [x0 + width * t, y1 - 5], 1.6))
            .join("")}
          fill="none"
          stroke={darken(colour, 0.3)}
          stroke-width={f(width * 0.12)}
          stroke-linecap="round"
          opacity="0.3"
        />
        <path
          d={band(y0 + 10) + band(y0 + 14) + (wrapped ? "" : band(y1 - 11))}
          fill="none"
          stroke={letters}
          stroke-width="1.4"
          stroke-linecap="round"
          opacity="0.85"
        />
        {wrapped && (
          <path
            d={outline(
              rnd,
              [
                [x0 - 1, y1 - 34],
                [x1 + 1, y1 - 34],
                [x1 + 1, y1 - 7],
                [x0 - 1, y1 - 7],
              ],
              0.8,
            )}
            fill={WRAP.paper}
            stroke={WRAP.edge}
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        )}
        {wrapped && (
          <path
            d={blob(
              Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI) / 4
                const r = Math.min(width / 2 - 6, 9) + (rnd() - 0.5)
                return [cx + r * Math.cos(a), y1 - 20.5 + r * Math.sin(a)] as Point
              }),
            )}
            fill={WRAP.tag}
            stroke={WRAP.ink}
            stroke-width="1.1"
          />
        )}
        <text
          class="shelves-title"
          transform={at(turn > 0 ? top : bottom)}
          style={`fill:${letters};font-size:${f(named.size)}px`}
        >
          {named.text}
        </text>
        {signed.text && (
          <text
            class="shelves-author"
            transform={at(turn > 0 ? bottom : top)}
            style={`fill:${letters};font-size:${f(signed.size)}px`}
          >
            {signed.text}
          </text>
        )}
      </svg>
    </a>
  )
}

// The board under a row of books, as a mask tile: two pencil edges, a few strokes of grain
// and the shadow hatching beneath. Its ends meet at the same height, so the tile repeats.
function boardTile(): string {
  const rnd = seeded(7)
  const y = BOOK_BOX
  const edge = (at: number, amp: number) => wobble(rnd, [0, at], [TILE, at], amp)
  const strokes = [edge(y + 2, 1.1), edge(y + 3.2, 0.8), edge(y + 15, 1), edge(y + 16, 1.4)]
  for (let i = 0; i < 5; i++) {
    const x = 30 + rnd() * (TILE - 160)
    strokes.push(wobble(rnd, [x, y + 6 + rnd() * 6], [x + 40 + rnd() * 80, y + 6 + rnd() * 6], 0.6))
  }
  const hatch = Array.from({ length: Math.floor(TILE / 9) }, (_, i) => {
    const x = 4 + i * 9 + rnd() * 3
    return `M${f(x)} ${y + 19} l${f(-5 - rnd() * 3)} ${f(7 + rnd() * 5)}`
  })
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${BOOK_BOX + BOARD}">` +
    `<g fill="none" stroke="#000" stroke-linecap="round">` +
    `<path stroke-width="1.5" d="${strokes.join("")}"/>` +
    `<path stroke-width="1" opacity=".55" d="${hatch.join("")}"/></g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const FADE =
  "linear-gradient(90deg, transparent, #000 2.5rem, #000 calc(100% - 2.5rem), transparent)"

viewRegistry.register({
  id: "shelves",
  name: "Shelves",
  icon: "library",
  render: ({ entries, view, slug }) => {
    const lang: Language = languageOf(slug) ?? "ru"
    const owned = ownLanguage(entries, lang)
    const groups = grouped(
      owned.filter(shelved),
      view.groupBy?.property,
      view.groupBy?.direction === "DESC",
    )
    // The stacks, each listed from the top down: what is being read lies on the first one.
    const aside = (status: string) =>
      owned
        .filter((b) => statusOf(b) === status)
        .map((item) => ({ item, path: withoutLanguage(item.entry.slug) }))
    const stacks: ReturnType<typeof aside>[] = []
    let tall = 0
    for (const waiting of aside("later")) {
      if (stacks.length === 0 || tall + lyingHeight(waiting.path) > BOOK_BOX) {
        stacks.push([])
        tall = 0
      }
      stacks[stacks.length - 1].unshift(waiting)
      tall += lyingHeight(waiting.path)
    }
    // A book being read goes on top of the first stack while there is room, else starts one.
    const height = (stack: ReturnType<typeof aside>) =>
      stack.reduce((sum, { path }) => sum + lyingHeight(path), 0)
    for (const reading of aside("in-progress")) {
      if (stacks.length === 0 || height(stacks[0]) + lyingHeight(reading.path) + 15 > BOOK_BOX) {
        stacks.unshift([])
      }
      stacks[0].unshift(reading)
    }
    return (
      <div class="shelves">
        {groups.map((group) => (
          <section class="shelves-shelf">
            <div class="shelves-row">
              {group.books.map(({ path, item }) => (
                <Spine book={item} path={path} from={slug as FullSlug} lang={lang} />
              ))}
            </div>
            {group.label && <p class="shelves-label">{group.label}</p>}
          </section>
        ))}
        {stacks.length > 0 && (
          <section class="shelves-shelf">
            <div class="shelves-row">
              {stacks.map((stack) => (
                <div class="shelves-stack">
                  {stack.map(({ path, item }) => (
                    <Spine book={item} path={path} from={slug as FullSlug} lang={lang} lying />
                  ))}
                </div>
              ))}
            </div>
            <p class="shelves-label">{UI[lang].stand}</p>
          </section>
        )}
      </div>
    )
  },
  css: `
${FONT_FACE}
.shelves {
  margin: 1.5rem 0 2rem;
}
article:has(.shelves) + .page-listing {
  display: none;
}
.shelves-shelf {
  margin-bottom: 1.25rem;
}
.shelves p.shelves-label {
  margin: -0.35rem 0 0 1.75rem;
  font-family: "Caveat", cursive;
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1;
  color: var(--darkgray);
}
.shelves-row {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  column-gap: 1px;
  padding: 0 1.75rem;
}
/* One board under every wrapped row: the tile is a row high, and pencil-coloured in both themes. */
.shelves-row::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--darkgray);
  pointer-events: none;
  -webkit-mask-image: ${FADE}, ${boardTile()};
  mask-image: ${FADE}, ${boardTile()};
  -webkit-mask-size: 100% 100%, ${TILE}px ${BOOK_BOX + BOARD}px;
  mask-size: 100% 100%, ${TILE}px ${BOOK_BOX + BOARD}px;
  -webkit-mask-repeat: no-repeat, repeat;
  mask-repeat: no-repeat, repeat;
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
}
a.internal.shelves-book {
  display: flex;
  align-items: flex-end;
  height: ${BOOK_BOX}px;
  margin-bottom: ${BOARD}px;
  padding: 0;
  border-radius: 0;
  background: none;
  line-height: 0;
  transform: rotate(var(--lean));
  transform-origin: 50% 100%;
  transition: transform 0.18s ease-out;
}
a.internal.shelves-book > svg {
  margin-bottom: -3px;
  overflow: visible;
}
a.internal.shelves-book:hover,
a.internal.shelves-book:focus-visible {
  transform: translateY(-12px) rotate(var(--lean));
}
a.internal.shelves-book:focus-visible {
  outline: 2px dashed var(--secondary);
  outline-offset: 2px;
}
/* A stack: the same spines lying on their sides, one on another. */
.shelves-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: ${BOOK_BOX}px;
  margin: 0 0.9rem ${BOARD}px 0;
}
a.internal.shelves-book.is-lying {
  position: relative;
  display: block;
  flex: none;
  margin: 0;
  transform: none;
}
a.internal.shelves-book.is-lying > svg {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: 0;
  transform: translate(-50%, -50%) rotate(var(--turn));
}
a.internal.shelves-book.is-lying:hover,
a.internal.shelves-book.is-lying:focus-visible {
  transform: translateX(-10px);
}
.shelves text {
  font-family: "Caveat", cursive;
  dominant-baseline: central;
}
.shelves-title {
  font-weight: 700;
}
.shelves-author {
  font-weight: 500;
  text-anchor: end;
}
@media (prefers-reduced-motion: reduce) {
  a.internal.shelves-book {
    transition: none;
  }
}
`,
})
