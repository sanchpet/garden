// The publication feed as plain data and the Atom 1.0 text made from it. Nothing here reads
// the clock, git or the file system: unchanged texts must give a byte-identical feed, since
// consumers treat a changed entry as an event.

import { isText } from "./kinds"

export type Page = {
  slug: string
  lang?: string
  frontmatter: Record<string, unknown>
}

export type Entry = {
  lang: string
  id: string
  title: string
  published: string
  updated: string
  summary?: string
  // The author's own announcement of the text; a consumer posts it in place of the title.
  content?: string
  categories: string[]
  related: string[]
}

export type Feed = {
  id: string
  home: string
  lang: string
  title: string
  author: string
  entries: Entry[]
}

// Atom requires feed-level `updated`; an empty feed gets a fixed one rather than the build time.
const EPOCH = "1970-01-01T00:00:00Z"

export function pageUrl(base: string, slug: string): string {
  return `${base}/${encodeURI(slug.replace(/(^|\/)index$/, "$1"))}`
}

// RFC 3339 in UTC. A value without an offset is read as UTC, not as the build machine's zone.
export function timestamp(value: unknown): string | undefined {
  let date: Date
  if (value instanceof Date) {
    date = value
  } else if (typeof value === "string" && value.trim()) {
    const text = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      date = new Date(`${text}T00:00:00Z`)
    } else {
      const zoned = /(Z|[+-]\d{2}:?\d{2})$/i.test(text)
      date = new Date(zoned ? text : `${text.replace(" ", "T")}Z`)
    }
  } else {
    return undefined
  }
  if (isNaN(date.getTime())) return undefined
  return date.toISOString().replace(/\.\d{3}Z$/, "Z")
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined
  return String(value).trim() || undefined
}

// A scalar is a list of one; YAML reads a bare `2024` as a number.
function list(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value]
  return [...new Set(items.flatMap((item) => text(item) ?? []))]
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim())
}

// By code unit, not by locale: the order must not depend on the build machine.
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isPublication(page: Page): boolean {
  const { type, draft } = page.frontmatter
  return isText(type) && draft !== true && draft !== "true"
}

// No entry: the page is not a publication, or cannot be one as written. The warnings say what
// in a publication's frontmatter was not usable, whether or not it cost the entry.
export function entryOf(page: Page, base: string): { entry?: Entry; warnings: string[] } {
  if (!isPublication(page)) return { warnings: [] }
  const fm = page.frontmatter
  const warnings: string[] = []
  const date = (field: string) => {
    const value = timestamp(fm[field])
    if (!value && !isAbsent(fm[field])) {
      warnings.push(`${page.slug}: ${field} is not a date: ${JSON.stringify(fm[field])}`)
    }
    return value
  }
  const [ownPublished, created, revised] = ["published", "created", "revised"].map(date)
  const published = ownPublished ?? created
  if (!page.lang) warnings.push(`${page.slug} left out: not in a language folder`)
  if (!published) warnings.push(`${page.slug} left out: no published or created date`)
  if (!page.lang || !published) return { warnings }
  const entry: Entry = {
    lang: page.lang,
    id: pageUrl(base, page.slug),
    title: text(fm.title) ?? page.slug,
    published,
    // A revision dated before the release is a typo, not a way to predate it.
    updated: revised && revised > published ? revised : published,
    summary: text(fm.description),
    content: text(fm.announce),
    categories: list(fm.channels),
    related: list(fm.link).filter((href) => /^https?:\/\//.test(href)),
  }
  return { entry, warnings }
}

export function buildFeed(
  entries: Entry[],
  lang: string,
  site: { base: string; title: string; author: string },
): Feed {
  return {
    id: `${site.base}/${lang}/feed.xml`,
    home: `${site.base}/${lang}/`,
    lang,
    title: site.title,
    author: site.author,
    entries: entries
      .filter((entry) => entry.lang === lang)
      .sort((a, b) => compare(b.published, a.published) || compare(a.id, b.id)),
  }
}

// Also drops the control characters XML 1.0 has no way to carry, escaped or not.
export function escapeXml(value: string): string {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function renderEntry(entry: Entry): string {
  const x = escapeXml
  const lines = [
    `<title>${x(entry.title)}</title>`,
    `<id>${x(entry.id)}</id>`,
    `<link rel="alternate" type="text/html" href="${x(entry.id)}"/>`,
    ...entry.related.map((href) => `<link rel="related" href="${x(href)}"/>`),
    `<published>${entry.published}</published>`,
    `<updated>${entry.updated}</updated>`,
  ]
  if (entry.summary) lines.push(`<summary type="text">${x(entry.summary)}</summary>`)
  if (entry.content) lines.push(`<content type="text">${x(entry.content)}</content>`)
  lines.push(...entry.categories.map((term) => `<category term="${x(term)}"/>`))
  return `  <entry>\n${lines.map((line) => `    ${line}`).join("\n")}\n  </entry>\n`
}

export function renderFeed(feed: Feed): string {
  const x = escapeXml
  const updated = feed.entries.reduce((max, e) => (e.updated > max ? e.updated : max), EPOCH)
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${x(feed.lang)}">
  <title>${x(feed.title)}</title>
  <id>${x(feed.id)}</id>
  <link rel="self" type="application/atom+xml" href="${x(feed.id)}"/>
  <link rel="alternate" type="text/html" href="${x(feed.home)}"/>
  <updated>${updated}</updated>
  <author>
    <name>${x(feed.author)}</name>
  </author>
${feed.entries.map(renderEntry).join("")}</feed>
`
}
