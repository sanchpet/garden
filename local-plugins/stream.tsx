import type { Element, ElementContent, Root } from "hast"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { htmlToJsx } from "../quartz/util/jsx"
import { FilePath, FullSlug, normalizeHastElement, resolveRelative } from "../quartz/util/path"
import { languageOf, type Language } from "./languages"
import { ranRaces } from "./races"
import { RING, ringOf } from "./radar"
import {
  byYear,
  formatDay,
  rows,
  streamOf,
  type Page,
  type Row,
  type StreamEvent,
} from "./stream-events"

const UI = {
  ru: {
    published: { post: "пост", evergreen: "вечнозелёная заметка" } as Record<string, string>,
    revised: (n?: number) => (n ? `редакция ${n}` : "новая редакция"),
    added: {
      book: ["новая книга", "новые книги"],
      course: ["новый курс", "новые курсы"],
    } as Record<string, string[]>,
    started: { book: "начал читать", course: "начал курс" } as Record<string, string>,
    finished: { book: "дочитал", course: "прошёл курс" } as Record<string, string>,
    radar: (ring: string) => `на радаре, «${ring}»`,
    moved: (was: string, ring: string) => `на радаре: «${was}» → «${ring}»`,
    ran: "пробежал",
    foreign: "",
    empty: "Здесь пока пусто.",
    feed: ["Тексты приходят и в читалку: ", "лента Atom", "."],
  },
  en: {
    published: { post: "post", evergreen: "evergreen note" } as Record<string, string>,
    revised: (n?: number) => (n ? `edition ${n}` : "new edition"),
    added: {
      book: ["new book", "new books"],
      course: ["new course", "new courses"],
    } as Record<string, string[]>,
    started: { book: "started reading", course: "started the course" } as Record<string, string>,
    finished: {
      book: "finished reading",
      course: "finished the course",
    } as Record<string, string>,
    radar: (ring: string) => `on the radar, “${ring}”`,
    moved: (was: string, ring: string) => `on the radar: “${was}” → “${ring}”`,
    ran: "ran",
    foreign: "The card exists only in Russian so far.",
    empty: "Nothing here yet.",
    feed: ["Texts also come to a feed reader: ", "Atom feed", "."],
  },
}
type Ui = (typeof UI)["en"]

function list(value: unknown): string[] {
  const items = Array.isArray(value) ? value : value == null ? [] : [value]
  return items.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []))
}

function ringName(ring: string | undefined, lang: Language): string {
  const known = ringOf(ring)
  return known ? RING[lang][known].name : (ring ?? "")
}

// What happened, in the author's words. A page of one species of text needs no such label.
function verbOf(row: Row, ui: Ui, lang: Language, single: boolean): string | undefined {
  const [first] = row.events
  switch (row.verb) {
    case "published":
      return single ? undefined : ui.published[row.species]
    case "revised":
      return ui.revised(first.edition)
    case "added":
      return row.species === "tool"
        ? ui.radar(ringName(first.ring, lang))
        : ui.added[row.species]?.[row.events.length > 1 ? 1 : 0]
    case "started":
      return ui.started[row.species]
    case "finished":
      return ui.finished[row.species]
    case "moved":
      return ui.moved(ringName(first.was, lang), ringName(first.ring, lang))
    case "ran":
      return ui.ran
    default:
      return undefined
  }
}

// Red means done (DESIGN.md): a finished book and a race that was run get the marker's tick.
const DONE: readonly string[] = ["finished", "ran"]
const Tick = () => (
  <svg class="stream-tick" viewBox="0 0 18 16" aria-hidden="true">
    <path d="M2.2 8.6 C3.9 9.7 5.4 11.9 6.6 13.9 C8.3 9.4 11.6 4.9 15.9 2.1" />
  </svg>
)

export const Stream = (() => {
  const List: QuartzComponent = ({ fileData, allFiles }) => {
    const fm = (fileData.frontmatter ?? {}) as Record<string, unknown>
    const slug = fileData.slug
    if (fm.type !== "stream" || !slug) return null
    const lang: Language = languageOf(slug) === "en" ? "en" : "ru"
    const ui = UI[lang]
    const show = list(fm.show)
    const pages: Page[] = allFiles.flatMap((file) =>
      file.slug && file.filePath?.endsWith(".md")
        ? [{ slug: file.slug, frontmatter: (file.frontmatter ?? {}) as Page["frontmatter"] }]
        : [],
    )
    const years = byYear(rows(streamOf(pages, ranRaces(lang), lang, show)))
    const bodies = new Map(allFiles.map((file) => [file.slug as string | undefined, file]))
    const href = (target: string) => resolveRelative(slug, target as FullSlug)

    // A card shown from the other language is starred, as the catalogues star it.
    let starred = false
    const target = (event: StreamEvent) => {
      if (!event.slug) {
        return (
          <a class="external p-name u-url" href={event.href}>
            {event.title}
          </a>
        )
      }
      const foreign = languageOf(event.slug) !== lang
      if (foreign) starred = true
      return (
        <>
          <a
            class="internal p-name u-url"
            href={href(event.slug)}
            lang={foreign ? languageOf(event.slug) : undefined}
            hreflang={foreign ? languageOf(event.slug) : undefined}
          >
            {event.title}
          </a>
          {foreign && <span class="stream-star">*</span>}
        </>
      )
    }

    // The body of a note as its own page shows it, with links rebased to this page.
    const note = (event: StreamEvent) => {
      const body = (bodies.get(event.slug)?.htmlAst as Root | undefined)?.children ?? []
      const root: Root = {
        type: "root",
        children: body.map((child) =>
          child.type === "element"
            ? (normalizeHastElement(
                child as Element,
                slug,
                event.slug as FullSlug,
              ) as ElementContent)
            : child,
        ),
      }
      return htmlToJsx(fileData.filePath as FilePath, root)
    }

    let previous = ""
    const row = (item: Row) => {
      const [first] = item.events
      const sameDay = item.day === previous && item.verb !== "noted"
      previous = item.day
      const day = (
        <time class="dt-published" datetime={item.day}>
          {formatDay(item.day, lang, "short")}
        </time>
      )
      const verb = verbOf(item, ui, lang, show.length === 1)
      const alone = item.events.length === 1
      return (
        <li class={`stream-row h-entry is-${item.verb}${sameDay ? " is-same-day" : ""}`}>
          {item.verb === "noted" ? (
            <a class="stream-day internal u-url" href={href(first.slug!)}>
              {day}
            </a>
          ) : (
            <span class="stream-day">{day}</span>
          )}
          {item.verb === "noted" ? (
            <div class="stream-note e-content">{note(first)}</div>
          ) : (
            <div class="stream-what">
              {verb && (
                <span class="stream-verb">
                  {DONE.includes(item.verb) && <Tick />}
                  {verb}
                </span>
              )}
              <span class="stream-names">
                {item.events.map((event, i) => (
                  <>
                    {i > 0 && ", "}
                    {target(event)}
                  </>
                ))}
                {alone && item.verb !== "published" && first.detail && (
                  <span class="stream-detail">, {first.detail}</span>
                )}
              </span>
              {item.verb === "published" && first.detail && (
                <p class="stream-summary p-summary">{first.detail}</p>
              )}
            </div>
          )}
        </li>
      )
    }

    const body = years.map(([year, items]) => (
      <>
        <h2 class="stream-year">{year}</h2>
        <ol class="stream-list">{items.map(row)}</ol>
      </>
    ))
    return (
      <section class="stream h-feed">
        {years.length === 0 && <p class="stream-empty">{ui.empty}</p>}
        {body}
        {starred && ui.foreign && <p class="stream-foreign">* {ui.foreign}</p>}
        <p class="stream-feed">
          {ui.feed[0]}
          <a href={`/${lang}/feed.xml`} data-router-ignore>
            {ui.feed[1]}
          </a>
          {ui.feed[2]}
        </p>
      </section>
    )
  }

  // Component CSS sits in a cascade layer and the core's base rules do not: where a rule
  // here competes with one of them (lists, headings, paragraphs), it carries the important flag.
  List.css = `
.stream {
  margin: 1.5rem 0 2rem;
}
.stream .stream-year {
  display: flex !important;
  align-items: center;
  gap: 0.9rem;
  margin: 2.2rem 0 0.6rem !important;
  font-family: "Caveat", cursive !important;
  font-size: 1.7rem !important;
  font-weight: 700 !important;
  line-height: 1 !important;
  color: var(--dark);
}
.stream .stream-year:first-child {
  margin-top: 0 !important;
}
.stream .stream-year::after {
  content: "";
  flex: 1;
  height: 6px;
  background: var(--darkgray);
  opacity: 0.6;
  -webkit-mask: var(--pencil-rule) center / 100% 100% no-repeat;
  mask: var(--pencil-rule) center / 100% 100% no-repeat;
}
.stream .stream-list {
  list-style: none !important;
  margin: 0 !important;
  padding: 0 !important;
}
.stream .stream-row {
  display: grid;
  grid-template-columns: 4.6rem minmax(0, 1fr);
  column-gap: 1.1rem;
  align-items: baseline;
  margin: 0 !important;
  padding: 0.42rem 0;
}
.stream .stream-day,
.stream .stream-row a.stream-day {
  font-family: "Caveat", cursive;
  font-size: 1.15rem;
  font-weight: 700 !important;
  line-height: 1.3;
  color: var(--gray) !important;
  white-space: nowrap;
  text-decoration: none !important;
}
.stream .stream-row a.stream-day:hover {
  color: var(--tertiary) !important;
}
.stream .is-same-day .stream-day {
  visibility: hidden;
}
.stream .stream-what {
  min-width: 0;
}
/* Links as in the text: underlined in pen, without the stock wash. */
.stream a,
.stream a.internal {
  background: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
  font-weight: 400 !important;
  text-decoration: underline !important;
  text-decoration-thickness: 1px !important;
  text-underline-offset: 0.18em !important;
  text-decoration-color: color-mix(in srgb, currentColor 45%, transparent) !important;
}
.stream a:hover {
  text-decoration-color: currentColor !important;
}
.stream .stream-star {
  color: var(--gray);
}
.stream .stream-verb {
  margin-right: 0.55rem;
  font-size: 0.85rem;
  color: var(--gray);
  white-space: nowrap;
}
.stream .is-moved .stream-verb,
.stream .is-added .stream-verb {
  white-space: normal;
}
.stream .stream-tick {
  width: 0.95rem;
  height: 0.85rem;
  margin-right: 0.3rem;
  vertical-align: -0.05rem;
  fill: none;
  stroke: #ec0e16;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.stream .is-published .stream-names,
.stream .is-revised .stream-names {
  font-weight: 600;
}
.stream .is-published .stream-names a,
.stream .is-revised .stream-names a {
  font-weight: 600 !important;
}
.stream .stream-detail {
  color: var(--gray);
}
.stream .stream-summary {
  margin: 0.15rem 0 0 !important;
  font-size: 1rem;
  font-style: italic;
  line-height: 1.5 !important;
  color: var(--gray);
}
.stream .is-noted {
  padding: 0.75rem 0;
}
/* A note reads here as on its own page. */
.stream .stream-note {
  font-size: 1.125rem;
  line-height: 1.65;
}
.stream .stream-note > :first-child {
  margin-top: 0 !important;
}
.stream .stream-note > :last-child {
  margin-bottom: 0 !important;
}
.stream .stream-empty,
.stream .stream-feed,
.stream .stream-foreign {
  color: var(--gray);
  font-size: 0.95rem;
}
.stream .stream-feed,
.stream .stream-foreign {
  margin: 2.2rem 0 0 !important;
}
.stream .stream-foreign + .stream-feed {
  margin-top: 0.4rem !important;
}
/* The stream opens with its own pencil rule and is the listing of its folder. */
hr:has(+ .page-footer .stream),
:has(+ hr + .page-footer .stream) > .page-listing {
  display: none !important;
}
@media (max-width: 560px) {
  .stream .stream-row {
    grid-template-columns: minmax(0, 1fr);
    padding: 0.5rem 0;
  }
  .stream .is-same-day .stream-day {
    display: none;
  }
}
`
  return (() => List) satisfies QuartzComponentConstructor
})()

// The way to the stream from every page: a handwritten word next to the mark.
export const StreamLink = (() => {
  const LABEL = { ru: "стрим", en: "stream" }
  const Link: QuartzComponent = ({ fileData, allFiles }) => {
    const slug = fileData.slug
    if (!slug) return null
    const lang: Language = languageOf(slug) ?? "ru"
    const target = `${lang}/stream`
    if (!allFiles.some((file) => file.slug === target)) return null
    return (
      <a
        class="stream-link"
        href={resolveRelative(slug, target as FullSlug)}
        aria-current={slug === target ? "page" : undefined}
      >
        {LABEL[lang]}
      </a>
    )
  }
  Link.css = `
a.stream-link {
  margin-right: 0.7rem;
  font-family: "Caveat", cursive !important;
  font-size: 1.45rem;
  font-weight: 700 !important;
  line-height: 1;
  color: var(--darkgray) !important;
  text-decoration: none !important;
}
a.stream-link:hover,
a.stream-link[aria-current] {
  color: var(--dark) !important;
  text-decoration: underline !important;
  text-decoration-thickness: 1.5px !important;
  text-underline-offset: 0.2em !important;
}
`
  return (() => Link) satisfies QuartzComponentConstructor
})()
