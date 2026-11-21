// A reader for the Atom the site's own emitter writes, not a general XML parser: no
// namespace prefixes, no nested markup inside text constructs.

export type FeedEntry = {
  id: string
  title: string
  // The page description; shown by feed readers, not posted.
  summary?: string
  // The author's own announcement, posted as the message when present.
  content?: string
  published?: string
  updated?: string
  categories: string[]
  related: string[]
  // The species of the text, from the category that carries KIND_SCHEME.
  kind?: string
}

// The same value as in local-plugins/feed-atom.ts, which writes it.
export const KIND_SCHEME = "https://sanch.pet/ns/kind"

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }

export function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] !== "#") return NAMED[ref.toLowerCase()] ?? whole
    const code = /^#x/i.test(ref) ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
  })
}

function content(raw: string): string {
  const text = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+)|<[^>]*>/g, (_, cdata, plain) =>
    cdata !== undefined ? cdata : plain !== undefined ? decodeXml(plain) : "",
  )
  return text.trim()
}

function element(xml: string, name: string): string | undefined {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml)
  return match ? content(match[1]) || undefined : undefined
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [, name, double, single] of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
    result[name] = decodeXml(double ?? single)
  return result
}

function emptyElements(xml: string, name: string): Record<string, string>[] {
  return [...xml.matchAll(new RegExp(`<${name}(\\s[^>]*?)?/?>`, "g"))].map((m) =>
    attributes(m[1] ?? ""),
  )
}

// Throws when the text is not a feed this reader understands: a feed that fails to parse
// must not pass for one with nothing new in it.
export function parseFeed(xml: string): { entries: FeedEntry[]; warnings: string[] } {
  const entries: FeedEntry[] = []
  const warnings: string[] = []
  const bare = xml.replace(/<!--[\s\S]*?-->/g, "")
  if (!/<feed[\s>]/.test(bare)) throw new Error("not an Atom feed: no <feed> element")
  const bodies = [...bare.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/g)]
  const opened = bare.match(/<entry[\s>]/g)?.length ?? 0
  if (opened !== bodies.length)
    throw new Error(`the feed has ${opened} <entry> tags, but only ${bodies.length} could be read`)
  for (const [, body] of bodies) {
    const id = element(body, "id")
    if (!id) {
      warnings.push(`an entry without <id> is skipped: ${element(body, "title") ?? "(untitled)"}`)
      continue
    }
    const categories = emptyElements(body, "category")
    entries.push({
      id,
      title: element(body, "title") ?? id,
      summary: element(body, "summary"),
      content: element(body, "content"),
      published: element(body, "published"),
      updated: element(body, "updated"),
      categories: categories.flatMap((a) => (a.scheme ? [] : a.term?.trim() || [])),
      kind: categories.find((a) => a.scheme === KIND_SCHEME)?.term?.trim() || undefined,
      related: emptyElements(body, "link").flatMap((a) =>
        a.rel === "related" && a.href ? a.href : [],
      ),
    })
  }
  return { entries, warnings }
}

export function telegramPost(entry: FeedEntry): string | undefined {
  return entry.related.find((href) => {
    try {
      return new URL(href).hostname === "t.me"
    } catch {
      return false
    }
  })
}
