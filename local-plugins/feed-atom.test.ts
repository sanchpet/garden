import test, { describe } from "node:test"
import assert from "node:assert"
import { buildFeed, entryOf, escapeXml, renderFeed, timestamp, type Page } from "./feed-atom"

const BASE = "https://sanch.pet"
const SITE = { base: BASE, title: "sanchpet", author: "sanchpet" }

function page(slug: string, frontmatter: Record<string, unknown>, lang?: string): Page {
  return { slug, lang: lang ?? slug.split("/")[0], frontmatter }
}
const entry = (p: Page) => entryOf(p, BASE).entry
const warnings = (p: Page) => entryOf(p, BASE).warnings
const feed = (pages: Page[], lang = "ru") =>
  buildFeed(
    pages.flatMap((p) => entry(p) ?? []),
    lang,
    SITE,
  )
// A dated post with the given extra frontmatter.
const post = (fm: Record<string, unknown>, slug = "ru/a") =>
  page(slug, { type: "post", created: "2026-01-02", ...fm })

const zaSekundu = page("ru/posts/za-sekundu", {
  type: "post",
  title: "За секунду",
  channels: ["lytdybr"],
  created: "2026-11-15",
  published: "2026-11-15",
  link: "https://t.me/sanchpetlytdybr/335",
})
const myshlenie = page("ru/evergreen/myshlenie", {
  type: "evergreen",
  title: "Мышление",
  created: "2026-10-26",
  revised: "2026-11-02",
  description: "Что есть",
})

describe("entry selection", () => {
  test("posts and evergreen texts are entries, without warnings", () => {
    for (const p of [zaSekundu, myshlenie]) {
      assert.ok(entry(p))
      assert.deepStrictEqual(warnings(p), [])
    }
  })

  test("other types and untyped pages are not, silently", () => {
    for (const type of ["book", "course", "races", "tool", undefined, 1]) {
      const p = page("ru/x", { type, created: "nonsense" })
      assert.deepStrictEqual(entryOf(p, BASE), { warnings: [] })
    }
  })

  test("drafts are not, silently", () => {
    for (const draft of [true, "true"]) {
      assert.deepStrictEqual(entryOf(post({ draft, created: undefined }), BASE), { warnings: [] })
    }
    assert.ok(entry(post({ draft: false })))
  })

  test("a text with no date is left out with a warning", () => {
    const p = page("ru/evergreen/x", { type: "evergreen", revised: "2026-04-01" })
    assert.strictEqual(entry(p), undefined)
    assert.deepStrictEqual(warnings(p), ["ru/evergreen/x left out: no published or created date"])
  })

  test("a publication outside the language folders is left out with a warning", () => {
    const p = { slug: "posts/stray", frontmatter: zaSekundu.frontmatter }
    assert.strictEqual(entry(p), undefined)
    assert.deepStrictEqual(warnings(p), ["posts/stray left out: not in a language folder"])
  })

  test("a feed holds its own language only", () => {
    const twin = page("en/evergreen/myshlenie", myshlenie.frontmatter)
    const ids = (lang: string) => feed([zaSekundu, myshlenie, twin], lang).entries.map((e) => e.id)
    assert.deepStrictEqual(ids("en"), [`${BASE}/en/evergreen/myshlenie`])
    assert.deepStrictEqual(ids("ru"), [
      `${BASE}/ru/posts/za-sekundu`,
      `${BASE}/ru/evergreen/myshlenie`,
    ])
  })
})

describe("entry fields", () => {
  test("id is the page address, without a trailing slash", () => {
    assert.strictEqual(entry(zaSekundu)!.id, "https://sanch.pet/ru/posts/za-sekundu")
    assert.strictEqual(entry(post({}, "ru/posts/index"))!.id, "https://sanch.pet/ru/posts/")
  })

  test("title is the page title, else the slug", () => {
    assert.strictEqual(entry(zaSekundu)!.title, "За секунду")
    assert.strictEqual(entry(post({}))!.title, "ru/a")
  })

  test("published falls back to created, updated to published", () => {
    const e = entry(post({}))!
    assert.strictEqual(e.published, "2026-01-02T00:00:00Z")
    assert.strictEqual(e.updated, "2026-01-02T00:00:00Z")
  })

  test("published wins over created", () => {
    assert.strictEqual(entry(post({ published: "2026-01-05" }))!.published, "2026-01-05T00:00:00Z")
  })

  test("a new edition moves updated and nothing else", () => {
    const first = entry(myshlenie)!
    const fm = { ...myshlenie.frontmatter, revised: "2026-12-01", revision: 3 }
    const revised = { ...myshlenie, frontmatter: fm }
    assert.strictEqual(first.updated, "2026-11-02T00:00:00Z")
    assert.deepStrictEqual(entry(revised), { ...first, updated: "2026-12-01T00:00:00Z" })
    assert.strictEqual(feed([revised]).entries.length, 1)
  })

  test("updated is never earlier than published", () => {
    const e = entry(post({ published: "2026-03-01", revised: "2026-02-01" }))!
    assert.strictEqual(e.published, "2026-03-01T00:00:00Z")
    assert.strictEqual(e.updated, "2026-03-01T00:00:00Z")
  })

  test("an unparseable date is reported, naming the page and the field", () => {
    const bad = post({ published: "soon", revised: 20261201 })
    assert.strictEqual(entry(bad)!.published, "2026-01-02T00:00:00Z")
    assert.strictEqual(entry(bad)!.updated, "2026-01-02T00:00:00Z")
    assert.deepStrictEqual(warnings(bad), [
      'ru/a: published is not a date: "soon"',
      "ru/a: revised is not a date: 20261201",
    ])
    assert.deepStrictEqual(warnings(post({ created: "2026-13-45" })), [
      'ru/a: created is not a date: "2026-13-45"',
      "ru/a left out: no published or created date",
    ])
  })

  test("an empty date field counts as absent", () => {
    assert.deepStrictEqual(warnings(post({ published: null, revised: " " })), [])
  })

  test("summary is the description, content the announcement; either, both or none", () => {
    const parts = (fm: Record<string, unknown>) => {
      const { summary, content } = entry(post(fm))!
      return { summary, content }
    }
    assert.deepStrictEqual(parts({ announce: "Анонс", description: "Описание" }), {
      summary: "Описание",
      content: "Анонс",
    })
    assert.deepStrictEqual(parts({ description: "Описание" }), {
      summary: "Описание",
      content: undefined,
    })
    assert.deepStrictEqual(parts({ announce: "Анонс" }), { summary: undefined, content: "Анонс" })
    assert.deepStrictEqual(parts({ announce: "  " }), { summary: undefined, content: undefined })
  })

  test("one category per channel", () => {
    const categories = (channels: unknown) => entry(post({ channels }))!.categories
    assert.deepStrictEqual(categories(["lytdybr", "sanchpetblog"]), ["lytdybr", "sanchpetblog"])
    assert.deepStrictEqual(categories("lytdybr"), ["lytdybr"])
    assert.deepStrictEqual(categories(undefined), [])
    assert.deepStrictEqual(categories([]), [])
  })

  test("channels are trimmed, de-duplicated in order, and numbers are names", () => {
    const categories = (channels: unknown) => entry(post({ channels }))!.categories
    assert.deepStrictEqual(categories([" b ", "a", "b", "", null, "a "]), ["b", "a"])
    assert.deepStrictEqual(categories([2024, "2024", 7]), ["2024", "7"])
    assert.deepStrictEqual(categories(2024), ["2024"])
    assert.deepStrictEqual(categories("a, b"), ["a, b"])
  })

  test("link becomes related links", () => {
    const related = (link: unknown) => entry(post({ link }))!.related
    assert.deepStrictEqual(related("https://t.me/sanchpetlytdybr/335"), [
      "https://t.me/sanchpetlytdybr/335",
    ])
    assert.deepStrictEqual(related(["https://t.me/a/1", "https://example.org/t/2"]), [
      "https://t.me/a/1",
      "https://example.org/t/2",
    ])
    assert.deepStrictEqual(related(undefined), [])
    assert.deepStrictEqual(related("[[a-note]]"), [])
  })
})

describe("timestamp", () => {
  test("is RFC 3339 in UTC whatever the input form", () => {
    assert.strictEqual(timestamp("2026-11-15"), "2026-11-15T00:00:00Z")
    assert.strictEqual(timestamp("2026-11-15T10:30"), "2026-11-15T10:30:00Z")
    assert.strictEqual(timestamp("2026-11-15 10:30:05"), "2026-11-15T10:30:05Z")
    assert.strictEqual(timestamp("2026-11-15T10:30:00+04:00"), "2026-11-15T06:30:00Z")
    assert.strictEqual(timestamp(new Date("2026-11-15T00:00:00Z")), "2026-11-15T00:00:00Z")
  })

  test("rejects what is not a date", () => {
    for (const value of [undefined, null, "", "soon", 20261115]) {
      assert.strictEqual(timestamp(value), undefined)
    }
  })
})

describe("ordering", () => {
  const dated = (slug: string, published: string) => page(slug, { type: "post", published })

  test("newest first, ties by id, whatever the input order", () => {
    const pages = [
      dated("ru/posts/b", "2026-01-01"),
      dated("ru/posts/c", "2026-03-01"),
      dated("ru/posts/a", "2026-01-01"),
      dated("ru/posts/d", "2025-12-31"),
    ]
    const order = (input: Page[]) => feed(input).entries.map((e) => e.id.split("/").pop())
    assert.deepStrictEqual(order(pages), ["c", "a", "b", "d"])
    assert.deepStrictEqual(order([...pages].reverse()), ["c", "a", "b", "d"])
  })

  test("no entry is dropped for length", () => {
    const pages = Array.from({ length: 250 }, (_, i) => dated(`ru/posts/p${i}`, "2026-01-01"))
    assert.strictEqual(feed(pages).entries.length, 250)
  })
})

describe("rendering", () => {
  test("escapes text and attributes", () => {
    assert.strictEqual(
      escapeXml(`a & b < c > d "e" 'f'`),
      "a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;",
    )
    assert.strictEqual(escapeXml("a\u0000b\u000Bc\td\ne￾f\uD800g"), "abc\td\nefg")
    assert.strictEqual(escapeXml("я퟿�\u{1F600}"), "я퟿�\u{1F600}")
    const nasty = post({
      title: "R&D <script>",
      announce: "Tom & Jerry <b>]]></b>",
      description: "Cats & mice",
      channels: ['a"b'],
      link: "https://t.me/x/1?a=1&b=2",
    })
    const xml = renderFeed(feed([nasty]))
    assert.ok(xml.includes("<title>R&amp;D &lt;script&gt;</title>"))
    assert.ok(xml.includes('<summary type="text">Cats &amp; mice</summary>'))
    assert.ok(
      xml.includes('<content type="text">Tom &amp; Jerry &lt;b&gt;]]&gt;&lt;/b&gt;</content>'),
    )
    assert.ok(xml.includes('<category term="a&quot;b"/>'))
    assert.ok(xml.includes('<link rel="related" href="https://t.me/x/1?a=1&amp;b=2"/>'))
  })

  test("the whole feed", () => {
    assert.strictEqual(
      renderFeed(feed([myshlenie, zaSekundu])),
      `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ru">
  <title>sanchpet</title>
  <id>https://sanch.pet/ru/feed.xml</id>
  <link rel="self" type="application/atom+xml" href="https://sanch.pet/ru/feed.xml"/>
  <link rel="alternate" type="text/html" href="https://sanch.pet/ru/"/>
  <updated>2026-11-15T00:00:00Z</updated>
  <author>
    <name>sanchpet</name>
  </author>
  <entry>
    <title>За секунду</title>
    <id>https://sanch.pet/ru/posts/za-sekundu</id>
    <link rel="alternate" type="text/html" href="https://sanch.pet/ru/posts/za-sekundu"/>
    <link rel="related" href="https://t.me/sanchpetlytdybr/335"/>
    <published>2026-11-15T00:00:00Z</published>
    <updated>2026-11-15T00:00:00Z</updated>
    <category term="lytdybr"/>
  </entry>
  <entry>
    <title>Мышление</title>
    <id>https://sanch.pet/ru/evergreen/myshlenie</id>
    <link rel="alternate" type="text/html" href="https://sanch.pet/ru/evergreen/myshlenie"/>
    <published>2026-10-26T00:00:00Z</published>
    <updated>2026-11-02T00:00:00Z</updated>
    <summary type="text">Что есть</summary>
  </entry>
</feed>
`,
    )
  })

  test("feed updated is the newest entry updated", () => {
    const old = page("ru/posts/old", {
      type: "post",
      published: "2020-01-01",
      revised: "2027-01-01",
    })
    const xml = renderFeed(feed([zaSekundu, old]))
    assert.ok(xml.includes("  <updated>2027-01-01T00:00:00Z</updated>\n  <author>"))
  })

  test("an empty feed is still a valid, stable document", () => {
    const xml = renderFeed(feed([], "en"))
    assert.ok(xml.includes("<updated>1970-01-01T00:00:00Z</updated>"))
    assert.ok(!xml.includes("<entry>"))
  })

  test("the same pages give the same bytes", () => {
    const render = (pages: Page[]) => renderFeed(feed(pages))
    assert.strictEqual(render([zaSekundu, myshlenie]), render([myshlenie, zaSekundu]))
  })
})
