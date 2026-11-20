// The publication feed as plain data and the Atom 1.0 text made from it. Nothing here reads
// the clock, git or the file system: unchanged texts must give a byte-identical feed, since
// consumers treat a changed entry as an event.

export type Page = {
  slug: string
  lang?: string
  title?: string
  frontmatter: Record<string, unknown>
}

export type Entry = {
  id: string
  title: string
  published: string
  updated: string
  summary?: string
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

const TYPES = new Set(["post", "evergreen"])
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
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function list(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value]
  return items.flatMap((item) => text(item) ?? [])
}

// By code unit, not by locale: the order must not depend on the build machine.
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isPublication(page: Page): boolean {
  const { type, draft } = page.frontmatter
  return typeof type === "string" && TYPES.has(type) && draft !== true && draft !== "true"
}

// undefined: the page is not a publication, or has no date to be published under.
export function entryOf(page: Page, base: string): Entry | undefined {
  const fm = page.frontmatter
  if (!isPublication(page)) return undefined
  const published = timestamp(fm.published) ?? timestamp(fm.created)
  if (!published) return undefined
  return {
    id: pageUrl(base, page.slug),
    title: text(page.title) ?? text(fm.title) ?? page.slug,
    published,
    updated: timestamp(fm.revised) ?? published,
    summary: text(fm.announce) ?? text(fm.description),
    categories: list(fm.channels),
    related: list(fm.link).filter((href) => /^https?:\/\//.test(href)),
  }
}

export function buildFeed(
  pages: Page[],
  lang: string,
  site: { base: string; title: string; author: string },
): Feed {
  const entries = pages
    .filter((page) => page.lang === lang)
    .flatMap((page) => entryOf(page, site.base) ?? [])
    .sort((a, b) => compare(b.published, a.published) || compare(a.id, b.id))
  return {
    id: `${site.base}/${lang}/feed.xml`,
    home: `${site.base}/${lang}/`,
    lang,
    title: site.title,
    author: site.author,
    entries,
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
