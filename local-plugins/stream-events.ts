// The stream: what happened in the garden, derived from the frontmatter of published pages.
// There is no stored journal of events. Like the feed, nothing here reads the clock, git or
// the file system: the same pages give the same stream.

import { timestamp } from "./feed-atom"
import { KINDS, type Species } from "./kinds"
import { languageOf, twinsOf, type Language } from "./languages"

export type Page = {
  slug: string
  frontmatter: Record<string, unknown>
}

export type Verb =
  | "published" // a post or an evergreen text came out
  | "revised" // a new edition of an evergreen text
  | "noted" // a note; the stream shows its body
  | "added" // a card appeared in a catalogue
  | "started"
  | "finished"
  | "moved" // a radar entry changed its ring
  | "ran" // a picked race marked as done

export type StreamEvent = {
  // RFC 3339 in UTC, for the order.
  at: string
  // The day as the author wrote it, for display and grouping.
  day: string
  verb: Verb
  species: Species
  // The page the event is about; a race has an outside address instead.
  slug?: string
  href?: string
  title: string
  detail?: string
  // What the verb needs to be said: an edition number, a ring, the ring left behind.
  edition?: number
  ring?: string
  was?: string
}

export type Race = {
  name: string
  start_date: string
  href: string
  place?: string
}

const CATALOGUE: readonly string[] = [...KINDS.source, ...KINDS.assessed]

function text(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined
  return String(value).trim() || undefined
}

// A date-only value is that day. A value with a time keeps the day it was written with when
// it arrives as a string; YAML turns an unquoted one into a Date, which only knows UTC.
export function dayOf(value: unknown): string | undefined {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return value.trim().slice(0, 10)
  }
  return timestamp(value)?.slice(0, 10)
}

function moment(value: unknown): { at: string; day: string } | undefined {
  const at = timestamp(value)
  const day = dayOf(value)
  return at && day ? { at, day } : undefined
}

export function eventsOf(page: Page): StreamEvent[] {
  const fm = page.frontmatter
  const species = fm.type as Species
  if (fm.draft === true || fm.draft === "true") return []
  const base = { species, slug: page.slug, title: text(fm.title) ?? page.slug }
  const events: StreamEvent[] = []
  const add = (when: unknown, verb: Verb, extra: Partial<StreamEvent> = {}) => {
    const at = moment(when)
    if (at) events.push({ ...at, verb, ...base, ...extra })
    return at
  }

  if (species === "post") {
    add(fm.published ?? fm.created, "published", { detail: text(fm.description) })
  } else if (species === "evergreen") {
    const out = add(fm.created, "published", { detail: text(fm.description) })
    const revised = moment(fm.revised)
    // A revision dated at or before the release is the release itself.
    if (revised && (!out || revised.at > out.at)) {
      const edition = Number(fm.revision)
      add(fm.revised, "revised", { edition: Number.isInteger(edition) ? edition : undefined })
    }
  } else if (species === "note") {
    add(fm.published ?? fm.created, "noted")
  } else if (species === "book" || species === "course") {
    const detail = text(fm.author)
    add(fm.created, "added", { detail })
    add(fm.started, "started", { detail })
    add(fm.finished, "finished", { detail })
  } else if (species === "tool") {
    const ring = text(fm.ring)
    const was = text(fm.was)
    const created = add(fm.created, "added", { ring: was ?? ring })
    const since = moment(fm.since)
    // Without `was` the entry has only ever been in one ring: `since` says from when the
    // author holds that opinion, which may predate the card and is no event of the garden.
    if (was && since && (!created || since.at > created.at)) add(fm.since, "moved", { ring, was })
  }
  return events
}

export function raceEvents(races: Race[]): StreamEvent[] {
  return races.flatMap((race) => {
    const at = moment(race.start_date)
    if (!at) return []
    return [
      {
        ...at,
        verb: "ran" as const,
        species: "races" as const,
        href: race.href,
        title: race.name,
        detail: race.place,
      },
    ]
  })
}

// A text speaks in its own language. A catalogue card exists once, in one language, and the
// other language's catalogues show it too: so does its stream, until the card is translated.
export function inStream(event: StreamEvent, lang: Language, slugs: ReadonlySet<string>): boolean {
  if (!event.slug) return true
  const own = languageOf(event.slug)
  if (own === lang) return true
  if (!own || !CATALOGUE.includes(event.species)) return false
  return !twinsOf(event.slug).some((twin) => languageOf(twin) === lang && slugs.has(twin))
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// Within a day the later step of a card's life stands above the earlier one.
const RANK: readonly Verb[] = [
  "noted",
  "published",
  "revised",
  "ran",
  "finished",
  "started",
  "moved",
  "added",
]

// Newest first; by code unit, so the order does not depend on the build machine.
export function sorted(events: StreamEvent[]): StreamEvent[] {
  return [...events].sort(
    (a, b) =>
      compare(b.day, a.day) ||
      compare(b.at, a.at) ||
      RANK.indexOf(a.verb) - RANK.indexOf(b.verb) ||
      compare(a.species, b.species) ||
      compare(a.ring ?? "", b.ring ?? "") ||
      compare(a.slug ?? a.href ?? "", b.slug ?? b.href ?? ""),
  )
}

export function streamOf(
  pages: Page[],
  races: Race[],
  lang: Language,
  show?: readonly string[],
): StreamEvent[] {
  const slugs = new Set(pages.map((page) => page.slug))
  const events = [...pages.flatMap(eventsOf), ...raceEvents(races)]
  return sorted(
    events.filter(
      (event) => inStream(event, lang, slugs) && (!show?.length || show.includes(event.species)),
    ),
  )
}

export type Row = {
  day: string
  verb: Verb
  species: Species
  events: StreamEvent[]
}

// Cards entered into a catalogue on one day are one line of the stream, not twenty.
const GATHERED: readonly Verb[] = ["added", "started", "finished"]

export function rows(events: StreamEvent[]): Row[] {
  const out: Row[] = []
  for (const event of events) {
    const last = out[out.length - 1]
    const joins =
      last &&
      GATHERED.includes(event.verb) &&
      last.day === event.day &&
      last.verb === event.verb &&
      last.species === event.species &&
      // A radar entry is said with its ring, so entries of different rings stay apart.
      last.events[0].ring === event.ring
    if (joins) last.events.push(event)
    else out.push({ day: event.day, verb: event.verb, species: event.species, events: [event] })
  }
  return out
}

export function byYear(list: Row[]): [string, Row[]][] {
  const years = new Map<string, Row[]>()
  for (const row of list) {
    const year = row.day.slice(0, 4)
    years.set(year, [...(years.get(year) ?? []), row])
  }
  return [...years]
}

// "21 Nov" in a row, "21 November 2026" as the heading of a note's own page.
export function formatDay(day: string, lang: Language, style: "short" | "long"): string {
  const text = new Date(`${day}T00:00:00Z`).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  })
  return text.replace(/\s*г\.$/, "")
}
