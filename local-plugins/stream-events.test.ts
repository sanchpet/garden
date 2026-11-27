import test, { describe } from "node:test"
import assert from "node:assert"
import { excerpt } from "./feed-atom"
import {
  byYear,
  eventsOf,
  rows,
  streamOf,
  textDates,
  type Page,
  type StreamEvent,
} from "./stream-events"

const page = (slug: string, frontmatter: Record<string, unknown>): Page => ({ slug, frontmatter })
const said = (events: StreamEvent[]) => events.map((e) => `${e.day} ${e.verb} ${e.title}`)

const post = page("ru/posts/a", { type: "post", title: "Пост", created: "2026-11-01" })
const book = (slug: string, fm: Record<string, unknown> = {}) =>
  page(`ru/library/${slug}`, { type: "book", title: slug, created: "2026-11-17", ...fm })

describe("events of a page", () => {
  test("a post comes out on its published date, else on its created one", () => {
    assert.deepStrictEqual(said(eventsOf(post)), ["2026-11-01 published Пост"])
    const dated = page("ru/posts/a", { ...post.frontmatter, published: "2026-11-03" })
    assert.deepStrictEqual(said(eventsOf(dated)), ["2026-11-03 published Пост"])
  })

  test("an evergreen text comes out once and is revised once", () => {
    const text = page("ru/evergreen/m", {
      type: "evergreen",
      title: "Мышление",
      created: "2026-10-26",
      revised: "2026-11-02",
      revision: 2,
    })
    const events = eventsOf(text)
    assert.deepStrictEqual(said(events), [
      "2026-10-26 published Мышление",
      "2026-11-02 revised Мышление",
    ])
    assert.strictEqual(events[1].edition, 2)
  })

  test("an evergreen text comes out on its published day, not the day it was started", () => {
    const text = page("ru/evergreen/m", {
      type: "evergreen",
      title: "Мышление",
      created: "2026-10-26",
      published: "2026-11-02",
      revised: "2026-11-02",
      revision: 2,
    })
    assert.deepStrictEqual(said(eventsOf(text)), ["2026-11-02 published Мышление"])
  })

  test("a text's header dates: release, and an edition only when later", () => {
    const evergreen = { type: "evergreen", created: "2026-10-26", published: "2026-11-02" }
    assert.deepStrictEqual(textDates({ ...evergreen, revised: "2026-11-02" }), {
      published: "2026-11-02",
      revised: undefined,
    })
    assert.deepStrictEqual(textDates({ ...evergreen, revised: "2026-11-20" }), {
      published: "2026-11-02",
      revised: "2026-11-20",
    })
    assert.deepStrictEqual(textDates({ type: "evergreen", created: "2026-10-26" }), {
      published: "2026-10-26",
      revised: undefined,
    })
    // A post has no editions: a stray `revised` is not shown.
    assert.deepStrictEqual(
      textDates({ type: "post", published: "2026-11-23", revised: "2026-11-25" }),
      {
        published: "2026-11-23",
        revised: undefined,
      },
    )
  })

  test("a revision dated at the release is the release", () => {
    const text = page("ru/evergreen/m", {
      type: "evergreen",
      created: "2026-10-26",
      revised: "2026-10-26",
    })
    assert.deepStrictEqual(
      eventsOf(text).map((e) => e.verb),
      ["published"],
    )
  })

  test("a source card is added, started and finished by its own dates", () => {
    const card = book("b", { started: "2026-11-18", finished: "2026-12-01", author: "Автор" })
    assert.deepStrictEqual(said(eventsOf(card)), [
      "2026-11-17 added b",
      "2026-11-18 started b",
      "2026-12-01 finished b",
    ])
    assert.strictEqual(eventsOf(card)[0].detail, "Автор")
  })

  test("a status without a date is no event", () => {
    assert.deepStrictEqual(said(eventsOf(book("b", { status: "done" }))), ["2026-11-17 added b"])
  })

  test("a radar entry moves only when it names the ring it left", () => {
    const tool = (fm: Record<string, unknown>) =>
      eventsOf(page("ru/engineering/radar/k3s", { type: "tool", title: "K3s", ...fm }))
    const settled = tool({ ring: "adopt", since: "2026-07-01", created: "2026-11-14" })
    assert.deepStrictEqual(said(settled), ["2026-11-14 added K3s"])
    assert.strictEqual(settled[0].ring, "adopt")

    const moved = tool({ ring: "trial", was: "assess", since: "2026-12-01", created: "2026-11-14" })
    assert.deepStrictEqual(said(moved), ["2026-11-14 added K3s", "2026-12-01 moved K3s"])
    assert.deepStrictEqual(
      moved.map((e) => [e.ring, e.was]),
      [
        ["assess", undefined],
        ["trial", "assess"],
      ],
    )
  })

  test("a draft, an untyped page and an unreadable date give nothing", () => {
    assert.deepStrictEqual(eventsOf(page("ru/posts/a", { ...post.frontmatter, draft: true })), [])
    assert.deepStrictEqual(eventsOf(page("ru/index", { title: "Сад", created: "2026-01-01" })), [])
    assert.deepStrictEqual(eventsOf(page("ru/posts/a", { type: "post", created: "скоро" })), [])
  })

  test("a note keeps the day it was written on", () => {
    const note = page("ru/notes/n", { type: "note", published: "2026-11-21T01:30+04:00" })
    const [event] = eventsOf(note)
    assert.strictEqual(event.day, "2026-11-21")
    assert.strictEqual(event.at, "2026-11-20T21:30:00Z")
  })
})

describe("the stream of a language", () => {
  const twin = page("en/posts/a", { type: "post", title: "Post", created: "2026-11-01" })
  const translated = page("en/library/b", { type: "book", title: "B", created: "2026-11-18" })
  const pages = [post, twin, book("a"), book("b"), translated]

  test("texts stay in their language, an untranslated card shows in both", () => {
    assert.deepStrictEqual(said(streamOf(pages, [], "en")), [
      "2026-11-18 added B",
      "2026-11-17 added a",
      "2026-11-01 published Post",
    ])
    assert.deepStrictEqual(said(streamOf(pages, [], "ru")), [
      "2026-11-17 added a",
      "2026-11-17 added b",
      "2026-11-01 published Пост",
    ])
  })

  test("`show` narrows the stream to the named species", () => {
    assert.deepStrictEqual(said(streamOf(pages, [], "ru", ["post"])), ["2026-11-01 published Пост"])
  })

  test("a race that was run is in both languages", () => {
    const race = { name: "Troodos Terra", start_date: "2027-05-23", href: "https://example.org" }
    for (const lang of ["ru", "en"] as const) {
      assert.strictEqual(said(streamOf(pages, [race], lang))[0], "2027-05-23 ran Troodos Terra")
    }
  })

  test("within a day the later step of a card stands above the earlier one", () => {
    const card = book("b", { started: "2026-11-17", finished: "2026-11-17" })
    assert.deepStrictEqual(
      streamOf([card], [], "ru").map((e) => e.verb),
      ["finished", "started", "added"],
    )
  })

  test("a note written later in a day stands above an earlier one", () => {
    const notes = [
      page("ru/notes/1", { type: "note", title: "утро", published: "2026-11-21T09:00+04:00" }),
      page("ru/notes/2", { type: "note", title: "вечер", published: "2026-11-21T19:00+04:00" }),
    ]
    assert.deepStrictEqual(said(streamOf(notes, [], "ru")), [
      "2026-11-21 noted вечер",
      "2026-11-21 noted утро",
    ])
  })
})

describe("rows", () => {
  test("cards added on one day are one row, texts are not gathered", () => {
    const other = page("ru/posts/b", { type: "post", title: "Б", created: "2026-11-17" })
    const more = page("ru/posts/c", { type: "post", title: "В", created: "2026-11-17" })
    const list = rows(streamOf([book("a"), book("b"), book("c"), other, more], [], "ru"))
    assert.deepStrictEqual(
      list.map((row) => [row.verb, row.events.length]),
      [
        ["published", 1],
        ["published", 1],
        ["added", 3],
      ],
    )
  })

  test("radar entries of different rings stay apart", () => {
    const tool = (slug: string, ring: string) =>
      page(`ru/engineering/radar/${slug}`, { type: "tool", ring, created: "2026-11-14" })
    const list = rows(
      streamOf([tool("a", "adopt"), tool("b", "assess"), tool("c", "adopt")], [], "ru"),
    )
    assert.deepStrictEqual(
      list.map((row) => [row.events[0].ring, row.events.length]),
      [
        ["adopt", 2],
        ["assess", 1],
      ],
    )
  })

  test("rows are split by year, newest first", () => {
    const old = page("ru/posts/o", { type: "post", created: "2025-03-01" })
    const years = byYear(rows(streamOf([post, old], [], "ru")))
    assert.deepStrictEqual(
      years.map(([year, list]) => [year, list.length]),
      [
        ["2026", 1],
        ["2025", 1],
      ],
    )
  })
})

describe("excerpt", () => {
  test("a short note is its own title", () => {
    assert.strictEqual(excerpt("  Купил  лыжи.\n"), "Купил лыжи.")
  })
  test("a long one is cut at a word, without trailing punctuation", () => {
    assert.strictEqual(excerpt("Раз два три, четыре пять", 14), "Раз два три…")
  })
})
