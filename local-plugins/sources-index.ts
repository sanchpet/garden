// The relation between texts and their sources as plain data: a text names its sources in
// frontmatter `sources`, a source card lists the texts that named it. Nothing here reads
// Quartz or the file system.

import { timestamp } from "./feed-atom"
import { isSource, isText } from "./kinds"
import { languageOf, twinsOf } from "./languages"

export type Page = { slug: string; frontmatter: Record<string, unknown> }

// A link to a card, or a source that has no card and is named by its text.
export type Item = { target: string; label?: string } | { text: string }

// One line of a bibliography; `slug` is set when the source has a published card.
export type Reference = { title: string; slug?: string; author?: string; year?: string }

export type Listing = { slug: string; title: string; type: string; published?: string }

export type Sources = {
  references: Map<string, Reference[]>
  // Per card: every rendition of every text that names it.
  texts: Map<string, Listing[]>
  problems: string[]
}

const WIKILINK = /^\[\[([^\]|]*)(?:\|([^\]]*))?\]\]$/
const LINKS = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|\[[^\]]*\]\(([^)\s]+)\)/g

function scalar(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
}

// By code unit, not by locale: the order must not depend on the build machine.
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// Unquoted, YAML reads `[[card|label]]` as a list within a list, split further at each comma.
function unquoted(value: unknown): string {
  return Array.isArray(value) ? `[[${value.flat(Infinity).map(scalar).join(", ")}]]` : scalar(value)
}

export function parseSources(value: unknown): Item[] {
  const raw = value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]
  return raw.flatMap((entry): Item[] => {
    const text = unquoted(entry)
    if (!text) return []
    const link = WIKILINK.exec(text)
    if (!link) return [{ text }]
    const label = link[2]?.trim()
    return [{ target: link[1].split("#")[0].trim(), ...(label ? { label } : {}) }]
  })
}

// Targets of the wikilinks and markdown links in a frontmatter value, however deep.
export function linkTargets(value: unknown): string[] {
  if (typeof value === "string") {
    return [...value.matchAll(LINKS)].map((match) => match[1] ?? match[2])
  }
  if (Array.isArray(value)) return value.flatMap(linkTargets)
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(linkTargets)
  return []
}

// A link names a page by its file name, with or without folders in front. The stock resolver
// gives up when the name is not unique among slugs and aliases; this one prefers the page in
// the reader's language and then the shortest path.
export function resolveLink(
  target: string,
  lang: string | undefined,
  slugs: Iterable<string>,
): string | undefined {
  const name = target
    .split("#")[0]
    .trim()
    .replace(/^\.?\//, "")
    .replace(/\.md$/, "")
  if (!name || /^[a-z][a-z0-9+.-]*:/i.test(name)) return undefined
  const names = [name, `${name}/index`]
  const matches = [...slugs].filter((slug) =>
    names.some((n) => slug === n || slug.endsWith(`/${n}`)),
  )
  const own = matches.filter((slug) => languageOf(slug) === lang)
  const pick = (list: string[]) => [...list].sort((a, b) => a.length - b.length || compare(a, b))[0]
  return pick(own) ?? pick(matches)
}

// A property as a reader would see it: every name of a list, a wikilink by its label or name.
function names(value: unknown): string {
  const items = Array.isArray(value) ? value : [value]
  return items
    .map((item) => {
      const text = unquoted(item)
      const link = WIKILINK.exec(text)
      return link ? (link[2] ?? link[1].split("/").pop()!).trim() : text
    })
    .filter(Boolean)
    .join(", ")
}

function referenceTo(card: Page): Reference {
  const fm = card.frontmatter
  const year = scalar(fm.year)
  return {
    slug: card.slug,
    title: scalar(fm.title) || card.slug.split("/").pop()!,
    ...(names(fm.author) ? { author: names(fm.author) } : {}),
    ...(year && year !== "0" ? { year } : {}),
  }
}

// «Author. Title. Year», the title apart so that it can carry the link to the card.
export function referenceParts(ref: Reference): { lead: string; title: string; tail: string } {
  const stop = (text: string) => (/[.!?…]$/.test(text) ? " " : ". ")
  return {
    lead: ref.author ? ref.author + stop(ref.author) : "",
    title: ref.title,
    tail: ref.year ? stop(ref.title).trimEnd() + " " + ref.year : "",
  }
}

function listingOf(page: Page): Listing {
  const fm = page.frontmatter
  const published = timestamp(fm.published) ?? timestamp(fm.created)
  return {
    slug: page.slug,
    title: scalar(fm.title) || page.slug,
    type: String(fm.type),
    ...(published ? { published } : {}),
  }
}

// `pages` are the published pages. `normalise` turns a link target into the form slugs have.
export function buildSources(pages: Page[], normalise = (target: string) => target): Sources {
  const bySlug = new Map(pages.map((page) => [page.slug, page]))
  const cards = pages.filter((page) => isSource(page.frontmatter.type)).map((page) => page.slug)
  const sources: Sources = { references: new Map(), texts: new Map(), problems: [] }
  const problems = new Set<string>()

  for (const page of pages) {
    if (!isText(page.frontmatter.type)) continue
    // A translation without a list of its own takes its twin's; an empty list is a list.
    const own = page.frontmatter.sources
    const twin =
      own === undefined || own === null
        ? twinsOf(page.slug).find((slug) => bySlug.get(slug)?.frontmatter.sources != null)
        : undefined
    const inherited = twin && bySlug.get(twin)!.frontmatter.sources
    const lang = languageOf(page.slug)
    const seen = new Set<string>()
    const references: Reference[] = []
    for (const item of parseSources(inherited ?? own)) {
      let ref: Reference | undefined
      if ("text" in item) {
        ref = { title: item.text }
      } else {
        const slug = item.target && resolveLink(normalise(item.target), lang, cards)
        if (slug) {
          ref = referenceTo(bySlug.get(slug)!)
        } else {
          if (item.label) ref = { title: item.label }
          // The owner of the list reports it once; the translation would only repeat it.
          if (!inherited) {
            const fate = item.label ? "shown as text" : "left out: it has no label"
            problems.add(
              `${page.slug}: source [[${item.target}]] is not a published source card, ${fate}`,
            )
          }
        }
      }
      if (!ref) continue
      const key = ref.slug ? `card ${ref.slug}` : `text ${ref.title}`
      if (seen.has(key)) continue
      seen.add(key)
      references.push(ref)
    }
    if (references.length === 0) continue
    sources.references.set(page.slug, references)
    for (const { slug } of references) {
      if (!slug) continue
      const texts = sources.texts.get(slug) ?? []
      texts.push(listingOf(page))
      sources.texts.set(slug, texts)
    }
  }
  sources.problems = [...problems]
  return sources
}

// One entry per translation pair, in the reader's language when there is one; newest first.
export function textsFor(listings: Listing[], lang: string | undefined): Listing[] {
  const pairs = new Map<string, Listing>()
  for (const listing of listings) {
    const own = languageOf(listing.slug)
    const key = own ? listing.slug.slice(own.length) : listing.slug
    const kept = pairs.get(key)
    if (!kept || (own === lang && languageOf(kept.slug) !== lang)) pairs.set(key, listing)
  }
  return [...pairs.values()].sort(
    (a, b) => compare(b.published ?? "", a.published ?? "") || compare(a.slug, b.slug),
  )
}
