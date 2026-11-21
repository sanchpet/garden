import test, { describe } from "node:test"
import assert from "node:assert"
import {
  buildSources,
  linkTargets,
  parseSources,
  referenceParts,
  resolveLink,
  textsFor,
  type Page,
} from "./sources-index"

const page = (slug: string, frontmatter: Record<string, unknown>): Page => ({ slug, frontmatter })
const misbehaving = page("ru/library/misbehaving", {
  type: "book",
  title: "Misbehaving",
  author: "Ричард Талер",
  year: 2015,
})
const kleppmann = page("ru/courses/kleppmann-distributed-systems", {
  type: "course",
  title: "Распределённые системы",
  author: "Мартин Клеппман",
  year: 2025,
})
const post = (sources: unknown, slug = "ru/posts/a", extra: Record<string, unknown> = {}) =>
  page(slug, { type: "post", title: "A", created: "2026-01-02", sources, ...extra })
const references = (pages: Page[], slug = "ru/posts/a") => buildSources(pages).references.get(slug)

describe("parsing the sources property", () => {
  test("a wikilink with a label, without one, with a folder and with a heading", () => {
    assert.deepStrictEqual(
      parseSources(["[[card|Label]]", "[[card]]", "[[library/card]]", "[[card#Chapter 2|L]]"]),
      [
        { target: "card", label: "Label" },
        { target: "card" },
        { target: "library/card" },
        { target: "card", label: "L" },
      ],
    )
  })

  test("a string without a wikilink is a source named by its text", () => {
    assert.deepStrictEqual(parseSources(["Some paper, 2020", "see [[card]] too", 2024]), [
      { text: "Some paper, 2020" },
      { text: "see [[card]] too" },
      { text: "2024" },
    ])
  })

  test("an unquoted wikilink arrives as nested lists and is still a link", () => {
    // `sources: [[card|Label]]` and `- [[card|Label, with a comma]]` as YAML reads them.
    assert.deepStrictEqual(parseSources([["card|Label"]]), [{ target: "card", label: "Label" }])
    assert.deepStrictEqual(parseSources([[["card|Label", "with a comma"]]]), [
      { target: "card", label: "Label, with a comma" },
    ])
  })

  test("a missing or empty property is no sources; a single string is a list of one", () => {
    for (const value of [undefined, null, [], "", "  ", [""], [null], [{}]]) {
      assert.deepStrictEqual(parseSources(value), [])
    }
    assert.deepStrictEqual(parseSources("[[card|L]]"), [{ target: "card", label: "L" }])
    assert.deepStrictEqual(parseSources("Plain"), [{ text: "Plain" }])
  })
})

describe("resolving a link", () => {
  const slugs = [
    "ru/library/misbehaving",
    "en/library/misbehaving",
    "ru/courses/misbehaving",
    "ru/library/outlive",
    "ru/library/index",
    "media/cover.jpg",
  ]

  test("by file name, in the reader's own language first", () => {
    assert.strictEqual(resolveLink("outlive", "ru", slugs), "ru/library/outlive")
    assert.strictEqual(resolveLink("misbehaving", "en", slugs), "en/library/misbehaving")
  })

  test("in the other language when the own one has no such page", () => {
    assert.strictEqual(resolveLink("outlive", "en", slugs), "ru/library/outlive")
  })

  test("a folder path is honoured", () => {
    assert.strictEqual(resolveLink("courses/misbehaving", "ru", slugs), "ru/courses/misbehaving")
    assert.strictEqual(resolveLink("en/library/misbehaving", "ru", slugs), "en/library/misbehaving")
    assert.strictEqual(resolveLink("nowhere/misbehaving", "ru", slugs), undefined)
  })

  test("the same name in two folders gives the shorter path, the same on every build", () => {
    assert.strictEqual(resolveLink("misbehaving", "ru", slugs), "ru/courses/misbehaving")
    assert.strictEqual(
      resolveLink("misbehaving", "ru", [...slugs].reverse()),
      "ru/courses/misbehaving",
    )
  })

  test("a heading, an extension and a leading slash do not change the page", () => {
    assert.strictEqual(resolveLink("outlive#Notes", "ru", slugs), "ru/library/outlive")
    assert.strictEqual(resolveLink("outlive.md", "ru", slugs), "ru/library/outlive")
    assert.strictEqual(resolveLink("/ru/library/outlive", "en", slugs), "ru/library/outlive")
  })

  test("a folder resolves to its index and a file keeps its extension", () => {
    assert.strictEqual(resolveLink("library", "ru", slugs), "ru/library/index")
    assert.strictEqual(resolveLink("cover.jpg", "ru", slugs), "media/cover.jpg")
  })

  test("a name that is only part of a file name, an address and nothing do not resolve", () => {
    assert.strictEqual(resolveLink("live", "ru", slugs), undefined)
    assert.strictEqual(resolveLink("d-034-private", "ru", slugs), undefined)
    assert.strictEqual(resolveLink("https://example.com/outlive", "ru", slugs), undefined)
    assert.strictEqual(resolveLink("#heading", "ru", slugs), undefined)
  })
})

describe("links in frontmatter", () => {
  test("wikilinks and markdown links are found in any property, however deep", () => {
    assert.deepStrictEqual(
      linkTargets({
        cover: "[[cover.jpg]]",
        drafts: ["[[d-034-private]]", "[[other|label]]"],
        nested: { note: "see [text](ru/library/outlive) and [[one]] and [[two#h]]" },
        year: 2015,
        empty: null,
      }),
      ["cover.jpg", "d-034-private", "other", "ru/library/outlive", "one", "two#h"],
    )
  })

  test("only the links that resolve to a page or a file of the site are kept", () => {
    const site = ["ru/evergreen/myshlenie", "media/thompson-big-sur.jpg"]
    const fm = { drafts: ["[[d-034-myshlenie]]"], cover: "[[thompson-big-sur.jpg]]" }
    const kept = linkTargets(fm).flatMap((target) => resolveLink(target, "ru", site) ?? [])
    assert.deepStrictEqual(kept, ["media/thompson-big-sur.jpg"])
  })
})

describe("the bibliography of a text", () => {
  test("a card whose alias equals its file name resolves: aliases are not candidates", () => {
    const card = page("ru/library/misbehaving", {
      ...misbehaving.frontmatter,
      aliases: ["Misbehaving"],
    })
    assert.deepStrictEqual(references([card, post(["[[misbehaving]]"])]), [
      {
        slug: "ru/library/misbehaving",
        title: "Misbehaving",
        author: "Ричард Талер",
        year: "2015",
      },
    ])
  })

  test("the order of the list is kept; a plain string stands between the cards as text", () => {
    const refs = references([
      misbehaving,
      kleppmann,
      post(["[[kleppmann-distributed-systems|Курс]]", "A <b>paper</b> & co", "[[misbehaving]]"]),
    ])
    assert.deepStrictEqual(
      refs?.map((ref) => [ref.slug, ref.title]),
      [
        ["ru/courses/kleppmann-distributed-systems", "Распределённые системы"],
        [undefined, "A <b>paper</b> & co"],
        ["ru/library/misbehaving", "Misbehaving"],
      ],
    )
  })

  test("the English text gets the English card when there is one, else the Russian", () => {
    const en = page("en/library/misbehaving", { type: "book", title: "Misbehaving (en)" })
    const text = post(["[[misbehaving]]", "[[kleppmann-distributed-systems]]"], "en/posts/a")
    assert.deepStrictEqual(
      references([misbehaving, en, kleppmann, text], "en/posts/a")?.map((ref) => ref.slug),
      ["en/library/misbehaving", "ru/courses/kleppmann-distributed-systems"],
    )
  })

  test("a link to a draft, a missing page or a page that is no source shows its label", () => {
    const other = page("ru/posts/za-sekundu", { type: "post", title: "За секунду" })
    const { references: refs, problems } = buildSources([
      misbehaving,
      other,
      post(["[[draft-card|Черновик]]", "[[za-sekundu|Не источник]]", "[[misbehaving]]"]),
    ])
    assert.deepStrictEqual(refs.get("ru/posts/a"), [
      { title: "Черновик" },
      { title: "Не источник" },
      {
        slug: "ru/library/misbehaving",
        title: "Misbehaving",
        author: "Ричард Талер",
        year: "2015",
      },
    ])
    assert.deepStrictEqual(problems, [
      "ru/posts/a: source [[draft-card]] is not a published source card, shown as text",
      "ru/posts/a: source [[za-sekundu]] is not a published source card, shown as text",
    ])
  })

  test("an unresolved link without a label is left out and reported", () => {
    const { references: refs, problems } = buildSources([post(["[[gone]]", "[[#only-heading]]"])])
    assert.strictEqual(refs.get("ru/posts/a"), undefined)
    assert.deepStrictEqual(problems, [
      "ru/posts/a: source [[gone]] is not a published source card, left out: it has no label",
      "ru/posts/a: source [[]] is not a published source card, left out: it has no label",
    ])
  })

  test("repeats are dropped: the same card by two spellings, the same string twice", () => {
    const refs = references([
      misbehaving,
      post([
        "[[misbehaving]]",
        "Paper",
        "[[library/misbehaving#ch|Again]]",
        "Paper",
        "[[gone|X]]",
        "[[gone|X]]",
      ]),
    ])
    assert.deepStrictEqual(
      refs?.map((ref) => ref.title),
      ["Misbehaving", "Paper", "X"],
    )
  })

  test("only texts have a bibliography; a text without sources has none", () => {
    const sources = buildSources([
      misbehaving,
      page("ru/library/outlive", { type: "book", sources: ["[[misbehaving]]"] }),
      page("ru/index", { sources: ["[[misbehaving]]"] }),
      post(undefined),
      post([], "ru/posts/b"),
    ])
    assert.strictEqual(sources.references.size, 0)
    assert.strictEqual(sources.texts.size, 0)
    assert.deepStrictEqual(sources.problems, [])
  })

  test("link targets are compared in the form the caller gives them", () => {
    const normalise = (target: string) => target.toLowerCase().replace(/ /g, "-")
    const sources = buildSources([misbehaving, post(["[[Misbehaving]]"])], normalise)
    assert.strictEqual(sources.references.get("ru/posts/a")?.[0].slug, "ru/library/misbehaving")
    assert.strictEqual(references([misbehaving, post(["[[Misbehaving|M]]"])])?.[0].slug, undefined)
  })
})

describe("a translation and its twin", () => {
  const original = post(["[[misbehaving]]", "[[gone|Gone]]"], "ru/posts/a")

  test("without a list of its own it takes the twin's, and reports nothing twice", () => {
    for (const own of [undefined, null]) {
      const twin = post(own, "en/posts/a")
      const { references: refs, problems } = buildSources([misbehaving, original, twin])
      assert.deepStrictEqual(refs.get("en/posts/a"), refs.get("ru/posts/a"))
      assert.strictEqual(refs.get("en/posts/a")?.length, 2)
      assert.strictEqual(problems.length, 1)
    }
  })

  test("its own list wins, even an empty one", () => {
    const empty = buildSources([misbehaving, original, post([], "en/posts/a")])
    assert.strictEqual(empty.references.get("en/posts/a"), undefined)
    const own = buildSources([misbehaving, original, post(["Own"], "en/posts/a")])
    assert.deepStrictEqual(own.references.get("en/posts/a"), [{ title: "Own" }])
  })

  test("an unquoted link survives the inheritance", () => {
    const quoted = buildSources([
      misbehaving,
      post([["misbehaving|M"]]),
      post(undefined, "en/posts/a"),
    ])
    assert.strictEqual(quoted.references.get("en/posts/a")?.[0].slug, "ru/library/misbehaving")
  })

  test("a text in no language folder, or without a twin, inherits nothing", () => {
    const sources = buildSources([misbehaving, original, post(undefined, "posts/a")])
    assert.strictEqual(sources.references.get("posts/a"), undefined)
    assert.strictEqual(buildSources([post(undefined, "en/posts/a")]).references.size, 0)
  })
})

describe("the line of a bibliography", () => {
  const line = (frontmatter: Record<string, unknown>) => {
    const card = page("ru/library/card", { type: "book", title: "Title", ...frontmatter })
    const { lead, title, tail } = referenceParts(references([card, post(["[[card]]"])])![0])
    return lead + title + tail
  }

  test("author, title, year", () => {
    assert.strictEqual(line({ author: "Author", year: 2015 }), "Author. Title. 2015")
    assert.strictEqual(line({ author: "Author", year: "2015" }), "Author. Title. 2015")
  })

  test("missing parts leave no stray punctuation", () => {
    assert.strictEqual(line({}), "Title")
    assert.strictEqual(line({ author: "Author" }), "Author. Title")
    assert.strictEqual(line({ year: 2015 }), "Title. 2015")
    for (const author of ["", " ", null, []]) assert.strictEqual(line({ author }), "Title")
    for (const year of [0, "0", "", null]) assert.strictEqual(line({ year }), "Title")
  })

  test("the author may be a list, a wikilink or an unquoted wikilink", () => {
    assert.strictEqual(line({ author: ["One", "Two"] }), "One, Two. Title")
    assert.strictEqual(line({ author: "[[people/Name]]" }), "Name. Title")
    assert.strictEqual(line({ author: "[[name|Shown]]" }), "Shown. Title")
    assert.strictEqual(line({ author: [["Name"]] }), "Name. Title")
  })

  test("punctuation that already ends a part is not doubled", () => {
    assert.strictEqual(line({ author: "Талер Р.", year: 2015 }), "Талер Р. Title. 2015")
    assert.strictEqual(line({ title: "What If?", year: 2014 }), "What If? 2014")
  })

  test("a card without a title is named by its file", () => {
    assert.strictEqual(line({ title: undefined }), "card")
  })
})

describe("the texts of a source card", () => {
  const texts = (pages: Page[], lang: string, card = "ru/library/misbehaving") =>
    textsFor(buildSources([misbehaving, kleppmann, ...pages]).texts.get(card) ?? [], lang)
  const from = (slug: string, extra: Record<string, unknown> = {}) =>
    post(["[[misbehaving]]"], slug, extra)

  test("every published text that names the card, with its kind and date", () => {
    const evergreen = page("ru/evergreen/b", {
      type: "evergreen",
      title: "B",
      created: "2026-03-01",
      published: "2026-03-05",
      sources: "[[misbehaving]]",
    })
    assert.deepStrictEqual(
      texts([from("ru/posts/a"), evergreen, post(["Other"], "ru/posts/c")], "ru"),
      [
        {
          slug: "ru/evergreen/b",
          title: "B",
          type: "evergreen",
          published: "2026-03-05T00:00:00Z",
        },
        { slug: "ru/posts/a", title: "A", type: "post", published: "2026-01-02T00:00:00Z" },
      ],
    )
    assert.deepStrictEqual(
      texts([from("ru/posts/a")], "ru", "ru/courses/kleppmann-distributed-systems"),
      [],
    )
  })

  test("one entry per translation pair, in the reader's language when there is one", () => {
    const pages = [from("ru/posts/a"), post(undefined, "en/posts/a"), from("ru/posts/only-ru")]
    assert.deepStrictEqual(
      texts(pages, "en").map((text) => text.slug),
      ["en/posts/a", "ru/posts/only-ru"],
    )
    assert.deepStrictEqual(
      texts(pages, "ru").map((text) => text.slug),
      ["ru/posts/a", "ru/posts/only-ru"],
    )
    assert.deepStrictEqual(
      texts([...pages].reverse(), "en").map((text) => text.slug),
      ["en/posts/a", "ru/posts/only-ru"],
    )
  })

  test("a translation with its own list that leaves the card out is not listed for it", () => {
    const pages = [from("ru/posts/a"), post(["Other"], "en/posts/a")]
    assert.deepStrictEqual(
      texts(pages, "en").map((text) => text.slug),
      ["ru/posts/a"],
    )
  })

  test("newest first, the undated last, ties by address", () => {
    const pages = [
      from("ru/posts/undated", { created: undefined }),
      from("ru/posts/old", { created: "2025-01-01" }),
      from("ru/posts/z", { created: "2026-05-05" }),
      from("ru/posts/b", { created: "2026-05-05" }),
      from("ru/posts/new", { created: "2025-01-01", published: "2026-09-09" }),
    ]
    const order = ["ru/posts/new", "ru/posts/b", "ru/posts/z", "ru/posts/old", "ru/posts/undated"]
    assert.deepStrictEqual(
      texts(pages, "ru").map((text) => text.slug),
      order,
    )
    assert.deepStrictEqual(
      texts([...pages].reverse(), "ru").map((text) => text.slug),
      order,
    )
  })
})
