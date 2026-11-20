import test, { describe } from "node:test"
import assert from "node:assert"
import { buildFeed, entryOf, escapeXml, renderFeed, timestamp, type Page } from "./feed-atom"

const BASE = "https://sanch.pet"
const SITE = { base: BASE, title: "sanchpet", author: "sanchpet" }

function page(slug: string, frontmatter: Record<string, unknown>, rest: Partial<Page> = {}): Page {
  return { slug, lang: slug.split("/")[0], title: slug, frontmatter, ...rest }
}

const post = page(
  "ru/posts/za-sekundu",
  {
    type: "post",
    channels: ["lytdybr"],
    created: "2026-11-15",
    published: "2026-11-15",
    link: "https://t.me/sanchpetlytdybr/335",
  },
  { title: "За секунду" },
)
const evergreen = page(
  "ru/evergreen/myshlenie",
  { type: "evergreen", created: "2026-10-26", revised: "2026-11-02", description: "Что есть" },
  { title: "Мышление" },
)

describe("entry selection", () => {
  test("posts and evergreen texts are entries", () => {
    assert.ok(entryOf(post, BASE))
    assert.ok(entryOf(evergreen, BASE))
  })

  test("other types and untyped pages are not", () => {
    for (const type of ["book", "course", "races", "tool", undefined, 1]) {
      assert.strictEqual(entryOf(page("ru/x", { type, created: "2026-01-01" }), BASE), undefined)
    }
  })

  test("drafts are not", () => {
    for (const draft of [true, "true"]) {
      const fm = { ...post.frontmatter, draft }
      assert.strictEqual(entryOf(page(post.slug, fm), BASE), undefined)
    }
    assert.ok(entryOf(page(post.slug, { ...post.frontmatter, draft: false }), BASE))
  })

  test("a text with no date is not", () => {
    const fm = { type: "evergreen", revised: "2026-04-01" }
    assert.strictEqual(entryOf(page("ru/evergreen/x", fm), BASE), undefined)
  })

  test("a feed holds its own language only", () => {
    const twin = page("en/evergreen/myshlenie", evergreen.frontmatter)
    const root = page("posts/stray", post.frontmatter, { lang: undefined })
    const ids = (lang: string) =>
      buildFeed([post, evergreen, twin, root], lang, SITE).entries.map((e) => e.id)
    assert.deepStrictEqual(ids("en"), [`${BASE}/en/evergreen/myshlenie`])
    assert.deepStrictEqual(ids("ru"), [
      `${BASE}/ru/posts/za-sekundu`,
      `${BASE}/ru/evergreen/myshlenie`,
    ])
  })
})

describe("entry fields", () => {
  test("id is the page address, without a trailing slash", () => {
    assert.strictEqual(entryOf(post, BASE)!.id, "https://sanch.pet/ru/posts/za-sekundu")
    const index = page("ru/posts/index", post.frontmatter)
    assert.strictEqual(entryOf(index, BASE)!.id, "https://sanch.pet/ru/posts/")
  })

  test("published falls back to created, updated to published", () => {
    const entry = entryOf(page("ru/a", { type: "post", created: "2026-01-02" }), BASE)!
    assert.strictEqual(entry.published, "2026-01-02T00:00:00Z")
    assert.strictEqual(entry.updated, "2026-01-02T00:00:00Z")
  })

  test("published wins over created", () => {
    const fm = { type: "post", created: "2026-01-02", published: "2026-01-05" }
    assert.strictEqual(entryOf(page("ru/a", fm), BASE)!.published, "2026-01-05T00:00:00Z")
  })

  test("a new edition moves updated and nothing else", () => {
    const first = entryOf(evergreen, BASE)!
    const fm = { ...evergreen.frontmatter, revised: "2026-12-01", revision: 3 }
    const second = entryOf({ ...evergreen, frontmatter: fm }, BASE)!
    assert.strictEqual(first.updated, "2026-11-02T00:00:00Z")
    assert.deepStrictEqual(second, { ...first, updated: "2026-12-01T00:00:00Z" })
    assert.strictEqual(buildFeed([{ ...evergreen, frontmatter: fm }], "ru", SITE).entries.length, 1)
  })

  test("summary is announce, else description, else absent", () => {
    const summary = (fm: Record<string, unknown>) =>
      entryOf(page("ru/a", { type: "post", created: "2026-01-02", ...fm }), BASE)!.summary
    assert.strictEqual(summary({ announce: "Анонс", description: "Описание" }), "Анонс")
    assert.strictEqual(summary({ description: "Описание" }), "Описание")
    assert.strictEqual(summary({}), undefined)
    assert.strictEqual(summary({ announce: "  " }), undefined)
  })

  test("one category per channel", () => {
    const categories = (channels: unknown) =>
      entryOf(page("ru/a", { type: "post", created: "2026-01-02", channels }), BASE)!.categories
    assert.deepStrictEqual(categories(["lytdybr", "sanchpetblog"]), ["lytdybr", "sanchpetblog"])
    assert.deepStrictEqual(categories("lytdybr"), ["lytdybr"])
    assert.deepStrictEqual(categories(undefined), [])
    assert.deepStrictEqual(categories([]), [])
  })

  test("link becomes related links", () => {
    const related = (link: unknown) =>
      entryOf(page("ru/a", { type: "post", created: "2026-01-02", link }), BASE)!.related
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
    const order = (input: Page[]) =>
      buildFeed(input, "ru", SITE).entries.map((e) => e.id.split("/").pop())
    assert.deepStrictEqual(order(pages), ["c", "a", "b", "d"])
    assert.deepStrictEqual(order([...pages].reverse()), ["c", "a", "b", "d"])
  })

  test("no entry is dropped for length", () => {
    const pages = Array.from({ length: 250 }, (_, i) => dated(`ru/posts/p${i}`, "2026-01-01"))
    assert.strictEqual(buildFeed(pages, "ru", SITE).entries.length, 250)
  })
})

describe("rendering", () => {
  test("escapes text and attributes", () => {
    assert.strictEqual(
      escapeXml(`a & b < c > d "e" 'f'`),
      "a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;",
    )
    assert.strictEqual(escapeXml("a\u0000b\u000Bc\td\ne"), "abc\td\ne")
    const nasty = page(
      "ru/posts/nasty",
      {
        type: "post",
        published: "2026-01-01",
        announce: "Tom & Jerry <b>]]></b>",
        channels: ['a"b'],
        link: "https://t.me/x/1?a=1&b=2",
      },
      { title: "R&D <script>" },
    )
    const xml = renderFeed(buildFeed([nasty], "ru", SITE))
    assert.ok(xml.includes("<title>R&amp;D &lt;script&gt;</title>"))
    assert.ok(
      xml.includes('<summary type="text">Tom &amp; Jerry &lt;b&gt;]]&gt;&lt;/b&gt;</summary>'),
    )
    assert.ok(xml.includes('<category term="a&quot;b"/>'))
    assert.ok(xml.includes('<link rel="related" href="https://t.me/x/1?a=1&amp;b=2"/>'))
  })

  test("the whole feed", () => {
    assert.strictEqual(
      renderFeed(buildFeed([evergreen, post], "ru", SITE)),
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
    const xml = renderFeed(buildFeed([post, old], "ru", SITE))
    assert.ok(xml.includes("  <updated>2027-01-01T00:00:00Z</updated>\n  <author>"))
  })

  test("an empty feed is still a valid, stable document", () => {
    const xml = renderFeed(buildFeed([], "en", SITE))
    assert.ok(xml.includes("<updated>1970-01-01T00:00:00Z</updated>"))
    assert.ok(!xml.includes("<entry>"))
  })

  test("the same pages give the same bytes", () => {
    const render = (pages: Page[]) => renderFeed(buildFeed(pages, "ru", SITE))
    assert.strictEqual(render([post, evergreen]), render([evergreen, post]))
  })
})
