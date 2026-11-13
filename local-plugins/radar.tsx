import { viewRegistry, type BasesEntry } from "@quartz-community/bases-page"
import { FullSlug, resolveRelative } from "../quartz/util/path"
import { languageOf } from "./bilingual"
import {
  BURGUNDY,
  CREAM,
  FONT_FACE,
  MARK,
  PAPER,
  PENCIL,
  f,
  lettering,
  outline,
  ownLanguage,
  plain,
  seeded,
  withoutLanguage,
  wobble,
  type Language,
} from "./bookcase"
import { hashPath, type Point } from "./bookcase/geometry"

// A Bases view, `type: radar`: the author's own tech radar, drawn as a pencil instrument with
// a fan-shaped scope. A ring says how far his own experience with a tool goes, the nearest to
// the hub being what he reaches for first; a sector is an area of his work, named in the
// view's `sectors`. The scope is the picture, the list under it is the content. No script.

export const RINGS = ["adopt", "trial", "assess", "hold"] as const
export type Ring = (typeof RINGS)[number]

export const RING: Record<Language, Record<Ring, { name: string; means: string }>> = {
  ru: {
    adopt: { name: "беру по умолчанию", means: "С него начинаю." },
    trial: { name: "гоняю", means: "Работает на моём кластере." },
    assess: { name: "пробую", means: "Только стенд: от него у меня ничего не зависит." },
    hold: { name: "не беру", means: "Пробовал и не начал бы с него." },
  },
  en: {
    adopt: { name: "my default", means: "What I start with." },
    trial: { name: "running", means: "It runs on a cluster of mine." },
    assess: { name: "trying", means: "Lab only: nothing of mine depends on it." },
    hold: { name: "not for me", means: "Tried it and would not start with it." },
  },
}

const UI = {
  ru: {
    plate: "радар",
    rest: "прочее",
    empty: "пока пусто",
    unplaced: "не размещено",
    since: "с",
    was: "было",
  },
  en: {
    plate: "radar",
    rest: "other",
    empty: "nothing yet",
    unplaced: "not placed",
    since: "since",
    was: "was",
  },
}

export function ringOf(value: unknown): Ring | undefined {
  return RINGS.find((ring) => ring === value)
}

// A frontmatter date arrives as a Date or as the string it was written with.
export function day(value: unknown, lang: Language): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
        ? new Date(`${value.slice(0, 10)}T00:00:00Z`)
        : undefined
  if (!date || Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

// The scope: a half disc on its flat side, the hub in the middle of that side.
const W = 720
const CX = W / 2
const BASE = 352
const R = 290
const BEZEL = 30
const PANEL = 104
const H = BASE + PANEL + 26
// Where each ring ends, from the hub outwards; the first begins clear of the knob.
const EDGE: Record<Ring, [number, number]> = {
  adopt: [26, 120],
  trial: [120, 184],
  assess: [184, 238],
  hold: [238, R],
}
const DOT = 11

const polar = (r: number, deg: number): Point => {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.cos(a), BASE - r * Math.sin(a)]
}

// An arc drawn by hand: it leaves the true circle by up to `amp` and comes back.
function arc(rnd: () => number, r: number, from: number, to: number, amp: number): string {
  const steps = Math.max(2, Math.round(Math.abs(to - from) / 9))
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const edge = i === 0 || i === steps
    return polar(r + (edge ? 0 : (rnd() * 2 - 1) * amp), from + ((to - from) * i) / steps)
  })
  let d = `M${f(points[0][0])} ${f(points[0][1])}`
  for (let i = 1; i < steps; i++) {
    const [p, q] = [points[i], points[i + 1]]
    const end = i === steps - 1 ? q : [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    d += `Q${f(p[0])} ${f(p[1])} ${f(end[0])} ${f(end[1])}`
  }
  return d
}

const round = (rnd: () => number, at: Point, r: number, amp: number) => {
  const n = 9
  const turn = rnd() * Math.PI
  const points = Array.from({ length: n }, (_, i): Point => {
    const a = turn + (i / n) * 2 * Math.PI
    const rr = r * 1.04 + (rnd() * 2 - 1) * amp
    return [at[0] + rr * Math.cos(a), at[1] + rr * Math.sin(a)]
  })
  const mid = (a: Point, b: Point) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(points[n - 1], points[0])
  return (
    `M${f(start[0])} ${f(start[1])}` +
    points
      .map((p, i) => {
        const m = mid(p, points[(i + 1) % n])
        return `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`
      })
      .join("") +
    "Z"
  )
}

interface Blip {
  entry: BasesEntry
  foreign: boolean
  path: string
  name: string
  ring: Ring | undefined
  area: string
  was: Ring | undefined
  number: number
  at?: Point
  deg?: number
}

viewRegistry.register({
  id: "radar",
  name: "Radar",
  icon: "radar",
  render: ({ entries, view, slug }) => {
    const lang: Language = languageOf(slug) ?? "ru"
    const ui = UI[lang]
    const note = typeof view.fallbackNote === "string" ? view.fallbackNote : ""
    const named: Record<string, unknown> =
      view.sectors && typeof view.sectors === "object" && !Array.isArray(view.sectors)
        ? (view.sectors as Record<string, unknown>)
        : {}
    const REST = ""
    const sectorOf = (area: unknown) =>
      typeof area === "string" && Object.hasOwn(named, area) ? area : REST
    const sectorLabel = (id: string) => (id === REST ? ui.rest : plain(named[id]) || id)

    const blips: Blip[] = ownLanguage(entries, lang)
      .map(({ entry, foreign }) => ({
        entry,
        foreign,
        path: withoutLanguage(entry.slug),
        name: plain(entry.title) || entry.fileProperties.basename,
        ring: ringOf(entry.properties.ring),
        area: sectorOf(entry.properties.area),
        was: ringOf(entry.properties.was),
        number: 0,
      }))
      .sort(
        (a, b) =>
          (a.ring ? RINGS.indexOf(a.ring) : RINGS.length) -
            (b.ring ? RINGS.indexOf(b.ring) : RINGS.length) || a.name.localeCompare(b.name),
      )
    blips.forEach((blip, i) => (blip.number = i + 1))
    const placed = blips.filter((blip) => blip.ring)

    // Only the sectors that hold something are drawn, in the order the view names them.
    const sectors = [...Object.keys(named), REST].filter((id) =>
      placed.some((blip) => blip.area === id),
    )
    const span = 180 / Math.max(1, sectors.length)
    // Sectors run left to right, as they are read.
    const bounds = (id: string): [number, number] => {
      const i = sectors.indexOf(id)
      return [180 - i * span, 180 - (i + 1) * span]
    }

    // A dot keeps clear of the ring edges, the spokes and the dots already down; the path
    // decides where it lands, so a tool stays put from build to build.
    const taken: Point[] = []
    for (const blip of [...placed].sort((a, b) => a.path.localeCompare(b.path))) {
      const rnd = seeded(hashPath(blip.path))
      const [r0, r1] = EDGE[blip.ring!]
      const [a0, a1] = bounds(blip.area)
      let best: { at: Point; deg: number; room: number } | undefined
      for (let i = 0; i < 40; i++) {
        const r = r0 + DOT + 5 + rnd() * (r1 - r0 - 2 * DOT - 10)
        const margin = Math.min(span / 2 - 1, (Math.asin((DOT + 7) / r) * 180) / Math.PI)
        const deg = a1 + margin + rnd() * (a0 - a1 - 2 * margin)
        const at = polar(r, deg)
        const room = Math.min(...taken.map((p) => Math.hypot(p[0] - at[0], p[1] - at[1])), 999)
        if (!best || room > best.room) best = { at, deg, room }
        if (room >= DOT * 2 + 6) break
      }
      blip.at = best!.at
      blip.deg = best!.deg
      taken.push(best!.at)
    }

    const rnd = seeded(hashPath("radar"))
    const pencil = (d: string, width = 1.3, opacity = 1) => (
      <path
        d={d}
        fill="none"
        stroke={PENCIL}
        stroke-width={width}
        stroke-linecap="round"
        opacity={opacity}
      />
    )
    const left = CX - R - BEZEL - 22
    const right = CX + R + BEZEL + 22
    const top = BASE - R - BEZEL - 14
    const bottom = BASE + PANEL
    const cut = 22
    const body: Point[] = [
      [left + cut, top],
      [right - cut, top],
      [right, top + cut],
      [right, bottom - cut],
      [right - cut, bottom],
      [left + cut, bottom],
      [left, bottom - cut],
      [left, top + cut],
    ]
    const screws: Point[] = [
      [left + 24, top + 24],
      [right - 24, top + 24],
      [left + 22, bottom - 22],
      [right - 22, bottom - 22],
    ]
    const sweep = 58 + rnd() * 14
    const knob: Point = [right - 118, BASE + 58]
    const from = slug as FullSlug

    return (
      <div class="radar">
        <svg
          class="radar-scope"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ui.plate}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* the feet, then the case */}
          {[left + 70, right - 70].map((x) => (
            <path
              d={outline(
                rnd,
                [
                  [x - 34, bottom - 2],
                  [x + 34, bottom - 2],
                  [x + 28, bottom + 18],
                  [x - 28, bottom + 18],
                ],
                0.8,
              )}
              fill={PENCIL}
              stroke={PENCIL}
              stroke-width="1.4"
              stroke-linejoin="round"
              opacity="0.75"
            />
          ))}
          <path
            class="radar-case"
            d={outline(rnd, body, 1.4)}
            stroke={PENCIL}
            stroke-width="2.2"
            stroke-linejoin="round"
          />
          {/* shade down the right side and along the foot */}
          {pencil(
            Array.from({ length: 26 }, (_, i) => {
              const y = top + 34 + i * 15 + rnd() * 5
              return y > bottom - 30
                ? ""
                : wobble(rnd, [right - 5, y], [right - 14 - rnd() * 6, y + 12 + rnd() * 5], 0.6)
            }).join(""),
            0.9,
            0.55,
          )}
          {pencil(
            Array.from({ length: 40 }, (_, i) => {
              const x = left + 34 + i * 16 + rnd() * 6
              return x > right - 34
                ? ""
                : wobble(rnd, [x, bottom - 5], [x + 9 + rnd() * 4, bottom - 13 - rnd() * 4], 0.6)
            }).join(""),
            0.9,
            0.45,
          )}
          {screws.map((at) => (
            <g>
              <path d={round(rnd, at, 6, 0.7)} fill={PAPER} stroke={PENCIL} stroke-width="1.2" />
              {pencil(wobble(rnd, [at[0] - 4, at[1] + 3], [at[0] + 4, at[1] - 3], 0.3), 1.1)}
            </g>
          ))}

          {/* the bezel and the glass */}
          <path
            d={`${arc(rnd, R + BEZEL, 180, 0, 1.6)}${wobble(rnd, polar(R + BEZEL, 0), polar(R + BEZEL, 180), 1, false)}Z`}
            fill={PAPER}
            stroke={PENCIL}
            stroke-width="1.8"
            stroke-linejoin="round"
          />
          <path
            class="radar-glass"
            d={`${arc(rnd, R, 180, 0, 1.2)}${wobble(rnd, polar(R, 0), polar(R, 180), 0.8, false)}Z`}
            stroke={PENCIL}
            stroke-width="1.6"
            stroke-linejoin="round"
          />
          {pencil(arc(rnd, R - 3, 176, 4, 1.8), 0.8, 0.45)}

          {/* the afterglow behind the sweep */}
          {pencil(
            Array.from({ length: 9 }, (_, i) => {
              const deg = sweep + 3 + i * 2.6
              return wobble(rnd, polar(40 + rnd() * 30, deg), polar(R - 12 - rnd() * 40, deg), 1.2)
            }).join(""),
            0.8,
            0.22,
          )}
          {pencil(wobble(rnd, polar(20, sweep), polar(R - 6, sweep), 1.2), 1.4, 0.7)}

          {/* rings and spokes */}
          {RINGS.slice(0, -1).map((ring) => (
            <g>
              {pencil(arc(rnd, EDGE[ring][1], 180, 0, 1.6), 1.2, 0.85)}
              {pencil(arc(rnd, EDGE[ring][1] + 1.5, 172, 9, 2), 0.7, 0.4)}
            </g>
          ))}
          {sectors
            .slice(1)
            .map((id) =>
              pencil(
                wobble(rnd, polar(EDGE.adopt[0], bounds(id)[0]), polar(R, bounds(id)[0]), 1.4),
              ),
            )}

          {/* sector names round the bezel */}
          {sectors.map((id, i) => {
            const [a0, a1] = bounds(id)
            const [p, q] = [polar(R + 9, a0 - 2), polar(R + 9, a1 + 2)]
            const room = (((a0 - a1 - 4) * Math.PI) / 180) * (R + 9)
            const label = lettering(sectorLabel(id), 22, room)
            return (
              <g>
                <path
                  id={`radar-rim-${i}`}
                  d={`M${f(p[0])} ${f(p[1])}A${R + 9} ${R + 9} 0 0 1 ${f(q[0])} ${f(q[1])}`}
                  fill="none"
                />
                <text class="radar-rim" style={`fill:${PENCIL};font-size:${f(label.size)}px`}>
                  <textPath href={`#radar-rim-${i}`} startOffset="50%" text-anchor="middle">
                    {label.text}
                  </textPath>
                </text>
              </g>
            )
          })}

          {/* the scale under the glass: the rings by name */}
          {RINGS.map((ring) => {
            const [r0, r1] = [ring === "adopt" ? 0 : EDGE[ring][0], EDGE[ring][1]]
            const label = lettering(RING[lang][ring].name, 17, r1 - r0 - 4, 0.5)
            return (
              <g>
                {pencil(wobble(rnd, [CX - r1, BASE + 4], [CX - r1, BASE + 13], 0.4), 1.1)}
                {pencil(wobble(rnd, [CX + r1, BASE + 4], [CX + r1, BASE + 13], 0.4), 1.1)}
                <text
                  class="radar-scale"
                  x={f(CX - (r0 + r1) / 2)}
                  y={BASE + 22}
                  style={`fill:${PENCIL};font-size:${f(label.size)}px`}
                >
                  {label.text}
                </text>
              </g>
            )
          })}

          {/* the panel: a lamp, a switch, the plate and a valve for a knob */}
          <path
            d={round(rnd, [left + 62, BASE + 66], 8, 0.8)}
            fill={MARK}
            stroke={BURGUNDY}
            stroke-width="1.6"
          />
          <path
            d={outline(
              rnd,
              [
                [left + 96, BASE + 56],
                [left + 132, BASE + 56],
                [left + 132, BASE + 76],
                [left + 96, BASE + 76],
              ],
              0.7,
            )}
            fill={PAPER}
            stroke={PENCIL}
            stroke-width="1.3"
            stroke-linejoin="round"
          />
          {pencil(wobble(rnd, [left + 114, BASE + 66], [left + 126, BASE + 50], 0.4), 3.2)}
          <text class="radar-plate" x={CX} y={BASE + 66} style={`fill:${PENCIL}`}>
            {ui.plate}
          </text>
          {pencil(wobble(rnd, [CX - 62, BASE + 84], [CX + 62, BASE + 84], 1), 1, 0.6)}
          <path
            d={round(rnd, knob, 21, 1.2)}
            fill={MARK}
            stroke={BURGUNDY}
            stroke-width="2.4"
            stroke-linejoin="round"
          />
          {[20, 80, 140].map((deg) => {
            const a = (deg * Math.PI) / 180
            const [dx, dy] = [16 * Math.cos(a), 16 * Math.sin(a)]
            return (
              <path
                d={wobble(rnd, [knob[0] - dx, knob[1] - dy], [knob[0] + dx, knob[1] + dy], 0.5)}
                fill="none"
                stroke={BURGUNDY}
                stroke-width="2"
                stroke-linecap="round"
              />
            )
          })}
          <path d={round(rnd, knob, 6, 0.5)} fill={CREAM} stroke={BURGUNDY} stroke-width="1.6" />

          {/* the hub */}
          <path d={round(rnd, [CX, BASE], 9, 0.8)} fill={PENCIL} stroke={PENCIL} stroke-width="1" />

          {/* the blips, each with the trace of where it came from */}
          {placed.map((blip) => {
            const at = blip.at!
            const dot = seeded(hashPath(blip.path) + 1)
            const r = Math.hypot(at[0] - CX, at[1] - BASE)
            const out =
              blip.was && blip.was !== blip.ring
                ? RINGS.indexOf(blip.was) > RINGS.indexOf(blip.ring!)
                  ? 1
                  : -1
                : 0
            return (
              <a
                class="radar-blip"
                href={resolveRelative(from, blip.entry.slug as FullSlug)}
                data-router-ignore
              >
                <title>{`${blip.name}: ${RING[lang][blip.ring!].name}`}</title>
                {out !== 0 &&
                  pencil(
                    wobble(
                      dot,
                      polar(r + out * (DOT + 3), blip.deg!),
                      polar(r + out * (DOT + 20), blip.deg!),
                      1,
                    ),
                    1.6,
                    0.8,
                  )}
                <path
                  d={round(dot, at, DOT, 1)}
                  fill={MARK}
                  stroke={BURGUNDY}
                  stroke-width="2"
                  stroke-linejoin="round"
                />
                <text
                  class="radar-number"
                  x={f(at[0])}
                  y={f(at[1])}
                  style={`fill:${CREAM};font-size:${blip.number > 99 ? 11 : 14}px`}
                >
                  {blip.number}
                </text>
              </a>
            )
          })}
        </svg>

        <div class="radar-legend">
          {[...RINGS, undefined].map((ring) => {
            const members = blips.filter((blip) => blip.ring === ring)
            if (!ring && members.length === 0) return null
            return (
              <section class="radar-ring">
                <p class="radar-ring-name">{ring ? RING[lang][ring].name : ui.unplaced}</p>
                {ring && <p class="radar-ring-means">{RING[lang][ring].means}</p>}
                {members.length === 0 ? (
                  <p class="radar-empty">{ui.empty}</p>
                ) : (
                  <ul>
                    {members.map((blip) => {
                      const description = plain(blip.entry.properties.description)
                      const since = day(blip.entry.properties.since, lang)
                      const meta = [
                        sectors.length > 1 || blip.area !== REST ? sectorLabel(blip.area) : "",
                        since && `${ui.since} ${since}`,
                        blip.was && blip.was !== ring && `${ui.was}: ${RING[lang][blip.was].name}`,
                      ].filter(Boolean)
                      return (
                        <li>
                          <span class="radar-dot" aria-hidden="true">
                            {blip.number}
                          </span>
                          <span>
                            <a
                              class="internal"
                              href={resolveRelative(from, blip.entry.slug as FullSlug)}
                              data-slug={blip.entry.slug}
                            >
                              {blip.name}
                            </a>
                            {blip.foreign && note && <sup title={note}>*</sup>}
                            {description && ` — ${description}`}
                            {meta.length > 0 && <span class="radar-meta">{meta.join(" · ")}</span>}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
        {note && blips.some((blip) => blip.foreign) && <p class="radar-note">* {note}</p>}
      </div>
    )
  },
  css: `
${FONT_FACE}
.radar {
  margin: 1.5rem 0 2rem;
}
/* The radar is its folder's index note; the folder listing under it would repeat the legend. */
article:has(.radar) + .page-listing {
  display: none;
}
.radar-scope {
  display: block;
  width: 100%;
  max-width: 46rem;
  height: auto;
  margin: 0 auto;
}
.radar-case {
  fill: var(--lightgray);
}
.radar-glass {
  fill: var(--light);
}
.radar-scope text {
  font-family: "Caveat", cursive;
  text-anchor: middle;
  dominant-baseline: central;
}
.radar-rim,
.radar-scale {
  font-weight: 600;
}
.radar-plate {
  font-size: 34px;
  font-weight: 700;
}
.radar-number {
  font-weight: 700;
  pointer-events: none;
}
.radar-blip > path {
  transition: transform 0.15s ease-out;
  transform-box: fill-box;
  transform-origin: center;
}
.radar-blip:hover > path:last-of-type,
.radar-blip:focus-visible > path:last-of-type {
  transform: scale(1.25);
}
.radar-blip:focus-visible {
  outline: none;
}
.radar-legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 1.25rem 2rem;
  margin-top: 1.5rem;
}
.radar p.radar-ring-name {
  margin: 0;
  font-family: "Caveat", cursive;
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--dark);
}
.radar p.radar-ring-means,
.radar p.radar-empty,
.radar p.radar-note {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  color: var(--gray);
}
.radar p.radar-empty {
  margin-top: 0.6rem;
  font-style: italic;
}
.radar p.radar-note {
  margin-top: 1.25rem;
  font-style: italic;
}
.radar-ring ul {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
}
.radar-ring li {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
  margin: 0 0 0.5rem;
}
.radar-dot {
  flex: none;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.3rem;
  box-sizing: border-box;
  border: 2px solid ${BURGUNDY};
  border-radius: 999px;
  background: ${MARK};
  color: ${CREAM};
  font-family: "Caveat", cursive;
  font-weight: 700;
  line-height: 1.25rem;
  text-align: center;
}
.radar-meta {
  display: block;
  font-size: 0.8rem;
  color: var(--gray);
}
@media (prefers-reduced-motion: reduce) {
  .radar-blip > path {
    transition: none;
  }
}
`,
})
