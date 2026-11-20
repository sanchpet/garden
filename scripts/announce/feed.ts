// A reader for the Atom the site's own emitter writes, not a general XML parser: no
// namespace prefixes, no nested markup inside text constructs.

export type FeedEntry = {
  id: string
  title: string
  summary?: string
  published?: string
  updated?: string
  categories: string[]
  related: string[]
}

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

export function parseFeed(xml: string): { entries: FeedEntry[]; warnings: string[] } {
  const entries: FeedEntry[] = []
  const warnings: string[] = []
  const bare = xml.replace(/<!--[\s\S]*?-->/g, "")
  for (const [, body] of bare.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/g)) {
    const id = element(body, "id")
    if (!id) {
      warnings.push(`an entry without <id> is skipped: ${element(body, "title") ?? "(untitled)"}`)
      continue
    }
    entries.push({
      id,
      title: element(body, "title") ?? id,
      summary: element(body, "summary"),
      published: element(body, "published"),
      updated: element(body, "updated"),
      categories: emptyElements(body, "category").flatMap((a) => a.term?.trim() || []),
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
