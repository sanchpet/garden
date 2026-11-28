import test, { describe } from "node:test"
import assert from "node:assert"
import { parseFeed } from "../scripts/announce/feed"
import {
  blocksText,
  buildFeed,
  entryOf,
  escapeXml,
  firstImage,
  renderFeed,
  timestamp,
  type Page,
} from "./feed-atom"

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

  test("a browser gets the stylesheet, a feed reader still reads the entries", () => {
    const xml = renderFeed(feed([myshlenie, zaSekundu]))
    const [declaration, stylesheet] = xml.split("\n")
    assert.strictEqual(declaration, '<?xml version="1.0" encoding="utf-8"?>')
    assert.strictEqual(stylesheet, '<?xml-stylesheet type="text/css" href="/static/feed.css"?>')
    assert.deepStrictEqual(
      parseFeed(xml).entries.map((entry) => entry.id),
      ["https://sanch.pet/ru/posts/za-sekundu", "https://sanch.pet/ru/evergreen/myshlenie"],
    )
  })

  test("a browser row links the text and shows its day; a note is named by its address", () => {
    const note: Page = {
      slug: "ru/notes/2026-11-22-0130",
      lang: "ru",
      frontmatter: { type: "note", created: "2026-11-22T01:30+04:00" },
      text: "Первые слова заметки",
    }
    const xml = renderFeed(feed([note, zaSekundu]))
    assert.ok(
      xml.includes(
        '<h:a class="row note" href="https://sanch.pet/ru/notes/2026-11-22-0130"><h:span>2026-11-22-0130</h:span> <h:time datetime="2026-11-22">22 ноября 2026</h:time></h:a>',
      ),
    )
    const en = renderFeed(feed([post({ title: "Speed" }, "en/posts/speed")], "en"))
    assert.ok(en.includes('<h:time datetime="2026-01-02">2 January 2026</h:time>'))
  })

  test("a feed reader reads the same entries with the browser rows as without them", () => {
    const note: Page = {
      slug: "ru/notes/2026-11-21-1830",
      lang: "ru",
      frontmatter: { type: "note", channels: ["lytdybr"], created: "2026-11-21T18:30+04:00" },
      text: "Заметка <с> разметкой & амперсандом",
      image: "../../media/a.jpg",
    }
    const xml = renderFeed(feed([note, zaSekundu, myshlenie]))
    const bare = xml.replace(/\n\s*<h:a [^\n]*<\/h:a>/g, "")
    assert.notStrictEqual(bare, xml)
    assert.deepStrictEqual(parseFeed(xml), parseFeed(bare))
  })

  test("a browser gets the note above the list; a feed reader ignores it", () => {
    const plain = feed([myshlenie, zaSekundu])
    const xml = renderFeed({
      ...plain,
      note: '<h:p>Скопируйте <h:a href="https://x.test/">адрес</h:a>.</h:p>',
    })
    assert.ok(
      xml.includes(
        '<h:div class="subscribe"><h:p class="label">подписка</h:p><h:p>Скопируйте <h:a href="https://x.test/">адрес</h:a>.</h:p></h:div>\n  <entry>',
      ),
    )
    assert.deepStrictEqual(parseFeed(xml), parseFeed(renderFeed(plain)))
    const en = renderFeed(feed([], "en"))
    assert.ok(en.includes('<h:p class="label">subscribe</h:p></h:div>'))
  })

  test("the whole feed", () => {
    assert.strictEqual(
      renderFeed(feed([myshlenie, zaSekundu])),
      `<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet type="text/css" href="/static/feed.css"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:h="http://www.w3.org/1999/xhtml" xml:lang="ru">
  <h:meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>sanchpet</title>
  <id>https://sanch.pet/ru/feed.xml</id>
  <link rel="self" type="application/atom+xml" href="https://sanch.pet/ru/feed.xml"/>
  <link rel="alternate" type="text/html" href="https://sanch.pet/ru/"/>
  <updated>2026-11-15T00:00:00Z</updated>
  <author>
    <name>sanchpet</name>
  </author>
  <h:div class="subscribe"><h:p class="label">подписка</h:p></h:div>
  <entry>
    <title>За секунду</title>
    <id>https://sanch.pet/ru/posts/za-sekundu</id>
    <link rel="alternate" type="text/html" href="https://sanch.pet/ru/posts/za-sekundu"/>
    <link rel="related" href="https://t.me/sanchpetlytdybr/335"/>
    <published>2026-11-15T00:00:00Z</published>
    <updated>2026-11-15T00:00:00Z</updated>
    <category term="lytdybr"/>
    <category scheme="https://sanch.pet/ns/kind" term="post"/>
    <h:a class="row" href="https://sanch.pet/ru/posts/za-sekundu"><h:span>За секунду</h:span> <h:time datetime="2026-11-15">15 ноября 2026</h:time></h:a>
  </entry>
  <entry>
    <title>Мышление</title>
    <id>https://sanch.pet/ru/evergreen/myshlenie</id>
    <link rel="alternate" type="text/html" href="https://sanch.pet/ru/evergreen/myshlenie"/>
    <published>2026-10-26T00:00:00Z</published>
    <updated>2026-11-02T00:00:00Z</updated>
    <summary type="text">Что есть</summary>
    <category scheme="https://sanch.pet/ns/kind" term="evergreen"/>
    <h:a class="row" href="https://sanch.pet/ru/evergreen/myshlenie"><h:span>Мышление</h:span> <h:time datetime="2026-10-26">26 октября 2026</h:time></h:a>
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

describe("a note", () => {
  const note = (fm: Record<string, unknown>, text?: string): Page => ({
    slug: "ru/notes/2026-11-21-1830",
    lang: "ru",
    frontmatter: { type: "note", published: "2026-11-21T18:30+04:00", ...fm },
    text,
  })

  test("is an entry titled by its first words, with its text as the announcement", () => {
    const body = "Пробежал 12 км по Черепашьему озеру. Туман такой, что города не видно. ".repeat(2)
    const made = entry(note({ channels: ["lytdybr"] }, body))!
    assert.strictEqual(
      made.title,
      "Пробежал 12 км по Черепашьему озеру. Туман такой, что города не видно. Пробежал…",
    )
    assert.strictEqual(made.content, body.trim())
    assert.strictEqual(made.published, "2026-11-21T14:30:00Z")
    assert.deepStrictEqual(made.categories, ["lytdybr"])
  })

  test("keeps an announcement written for it", () => {
    assert.strictEqual(entry(note({ announce: "Коротко." }, "Длинно."))!.content, "Коротко.")
  })

  test("without text falls back to its title", () => {
    const made = entry(note({ title: "21 ноября 2026" }))!
    assert.strictEqual(made.title, "21 ноября 2026")
    assert.strictEqual(made.content, undefined)
  })

  test("carries its first picture as an enclosure, resolved against its page", () => {
    const made = entry({ ...note({}, "Туман."), image: "../../media/tuman%20utrom.jpg" })!
    assert.strictEqual(made.image, "https://sanch.pet/media/tuman%20utrom.jpg")
    assert.match(
      renderFeed(feed([{ ...note({}, "Туман."), image: "../../media/tuman.jpg" }])),
      /<link rel="enclosure" type="image\/jpeg" href="https:\/\/sanch\.pet\/media\/tuman\.jpg"\/>/,
    )
  })

  test("a picture Telegram cannot take as a photo is left out with a warning", () => {
    const { entry: made, warnings } = entryOf(
      { ...note({}, "Схема."), image: "../../media/scheme.svg" },
      "https://sanch.pet",
    )
    assert.strictEqual(made!.image, undefined)
    assert.match(warnings[0], /not JPEG, PNG, WebP or GIF/)
  })

  test("a post carries no picture: its preview is the page's own card", () => {
    assert.strictEqual(entry({ ...post({}), image: "../media/a.jpg" })!.image, undefined)
  })

  test("the first picture is found in document order", () => {
    const tree = {
      type: "root",
      children: [
        { type: "element", tagName: "p", children: [{ type: "text", value: "a" }] },
        {
          type: "element",
          tagName: "p",
          children: [
            { type: "element", tagName: "img", properties: { src: "../../media/one.png" } },
            { type: "element", tagName: "img", properties: { src: "../../media/two.png" } },
          ],
        },
      ],
    }
    assert.strictEqual(firstImage(tree), "../../media/one.png")
    assert.strictEqual(firstImage({ type: "root", children: [] }), undefined)
  })

  test("a post does not take its text for an announcement", () => {
    assert.strictEqual(entry({ ...post({}), text: "Текст поста." })!.content, undefined)
  })
})

describe("the species of an entry", () => {
  test("is a category of its own scheme, after the channels", () => {
    const xml = renderFeed(feed([zaSekundu]))
    assert.match(
      xml,
      /<category term="lytdybr"\/>\n\s*<category scheme="https:\/\/sanch\.pet\/ns\/kind" term="post"\/>/,
    )
  })
})

describe("blocksText", () => {
  const el = (tagName: string, ...children: unknown[]) => ({
    type: "element",
    tagName,
    children: children.map((c) => (typeof c === "string" ? { type: "text", value: c } : c)),
  })
  const root = (...children: unknown[]) => ({ type: "root", children }) as never

  test("paragraphs stand apart, a line break stays a line break", () => {
    const body = root(
      el("p", "Сижу, ковыряю ", el("a", "сайтец"), "."),
      { type: "text", value: "\n" },
      el("p", "Первая строка", el("br"), "\nвторая строка"),
    )
    assert.strictEqual(blocksText(body), "Сижу, ковыряю сайтец.\n\nПервая строка\nвторая строка")
  })

  test("a list is one block, an item per line; a quotation keeps its paragraphs", () => {
    const body = root(
      el("ul", el("li", "раз"), el("li", el("p", "два"))),
      el("blockquote", el("p", "цитата")),
    )
    assert.strictEqual(blocksText(body), "— раз\n— два\n\nцитата")
  })

  test("a wrapper around the blocks does not glue them", () => {
    assert.strictEqual(blocksText(root(el("div", el("p", "а"), el("p", "б")))), "а\n\nб")
  })
})
