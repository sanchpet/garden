import type { BasesEntry } from "@quartz-community/bases-page"
import type { ShelfGroup } from "./geometry"
import { languageOf, type Language } from "../languages"

// What the shelves make of the base's entries, apart from drawing them.

// A property as a reader would see it: the first of a list, a wikilink by its name.
export function plain(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first !== "string" && typeof first !== "number") return ""
  const text = String(first).trim()
  const link = /^\[\[([^\]|]*)(?:\|([^\]]*))?\]\]$/.exec(text)
  return link ? (link[2] ?? link[1].split("/").pop()!).trim() : text
}

export interface Shelved {
  entry: BasesEntry
  foreign: boolean
}

export const withoutLanguage = (slug: string) =>
  languageOf(slug) ? slug.slice(slug.indexOf("/") + 1) : slug
export const statusOf = (book: Shelved) =>
  typeof book.entry.properties.status === "string" ? book.entry.properties.status : ""
// A book begun or waiting is not on the shelves.
export const shelved = (book: Shelved) => !["later", "in-progress"].includes(statusOf(book))

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

// A section is named in each card's own language. A card shown on a shelf of the other
// language takes the name its translated neighbours give the same section there.
export function sectionNames(
  entries: BasesEntry[],
  property: string | undefined,
  lang: Language,
): Map<string, string> {
  const key = property?.replace(/^note\./, "")
  const names = new Map<string, string>()
  if (!key) return names
  const own = new Map<string, string>()
  for (const entry of entries)
    if (languageOf(entry.slug) === lang)
      own.set(withoutLanguage(entry.slug), plain(entry.properties[key]))
  for (const entry of entries) {
    const translated = own.get(withoutLanguage(entry.slug))
    const name = plain(entry.properties[key])
    if (languageOf(entry.slug) !== lang && translated && name && !names.has(name))
      names.set(name, translated)
  }
  return names
}

// Bases sorts the entries by the view's `sort`, so the shelves take their order from the
// group value itself.
export function grouped(
  books: Shelved[],
  property: string | undefined,
  descending: boolean,
  names: ReadonlyMap<string, string> = new Map(),
): ShelfGroup<Shelved>[] {
  const key = property?.replace(/^note\./, "")
  const groups = new Map<string, Shelved[]>()
  for (const book of books) {
    const own = key ? plain(book.entry.properties[key]) : ""
    const name = book.foreign ? (names.get(own) ?? own) : own
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
