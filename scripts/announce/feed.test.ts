import assert from "node:assert"
import test, { describe } from "node:test"
import { KIND_SCHEME, parseFeed, telegramPost } from "./feed"
import { fixture } from "./fixtures/load"

describe("parseFeed", () => {
  test("reads the entries and leaves the feed's own elements out", () => {
    const entries = fixture()
    assert.deepStrictEqual(
      entries.map((entry) => entry.id),
      [
        "https://sanch.pet/ru/posts/unknown-channel",
        "https://sanch.pet/ru/posts/novyj-post",
        "https://sanch.pet/ru/evergreen/myshlenie",
        "https://sanch.pet/ru/posts/za-sekundu",
      ],
    )
    assert.deepStrictEqual(entries[3], {
      id: "https://sanch.pet/ru/posts/za-sekundu",
      title: "За секунду",
      summary: "Что может успеть произойти за секунду?",
      content: undefined,
      published: "2026-11-05T00:00:00Z",
      updated: "2026-11-05T00:00:00Z",
      categories: ["lytdybr"],
      related: ["https://t.me/sanchpetlytdybr/334"],
      kind: undefined,
      image: "https://sanch.pet/ru/posts/za-sekundu.png",
    })
  })

  test("decodes character references", () => {
    const entry = fixture()[1]
    assert.strictEqual(entry.title, "Мышление & <практика>")
    assert.strictEqual(entry.summary, "Что есть мышление & зачем учиться мыслить — коротко.")
    assert.strictEqual(entry.content, "Написал про мышление & <практику>.\nВторая строка анонса.")
  })

  test("an entry without summary, categories or related links", () => {
    const entry = fixture()[0]
    assert.strictEqual(entry.summary, undefined)
    assert.deepStrictEqual(fixture()[2].categories, [])
    assert.deepStrictEqual(entry.related, [])
  })

  test("reads CDATA and several categories", () => {
    const { entries } = parseFeed(
      `<feed><entry><id>https://sanch.pet/a</id><title type="text"><![CDATA[A < B]]></title>` +
        `<category term='one'/><category term="two" label="x"></category></entry></feed>`,
    )
    assert.strictEqual(entries[0].title, "A < B")
    assert.deepStrictEqual(entries[0].categories, ["one", "two"])
  })

  test("skips an entry without an id and says so", () => {
    const { entries, warnings } = parseFeed("<feed><entry><title>Lost</title></entry></feed>")
    assert.deepStrictEqual(entries, [])
    assert.match(warnings[0], /Lost/)
  })

  test("a feed without entries is a quiet day", () => {
    assert.deepStrictEqual(parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom"></feed>`), {
      entries: [],
      warnings: [],
    })
  })

  test("what cannot be read is an error, not a quiet day", () => {
    assert.throws(() => parseFeed("<html><body>502 Bad Gateway</body></html>"), /not an Atom feed/)
    assert.throws(() => parseFeed(""), /not an Atom feed/)
    assert.throws(
      () => parseFeed("<feed><atom:entry><id>a</id></atom:entry><entry><id>b</id></feed>"),
      /1 <entry> tags, but only 0 could be read/,
    )
    assert.throws(
      () => parseFeed("<feed><entry><id>a</id></entry><entry><id>b</id></feed>"),
      /2 <entry> tags, but only 1/,
    )
  })
})

describe("telegramPost", () => {
  test("only a related link to t.me counts", () => {
    const [unknown, , , bySelf] = fixture()
    assert.strictEqual(telegramPost(bySelf), "https://t.me/sanchpetlytdybr/334")
    assert.strictEqual(telegramPost(unknown), undefined)
    assert.strictEqual(
      telegramPost({ ...unknown, related: ["https://example.com/t.me/1", "not a url"] }),
      undefined,
    )
  })
})

describe("the species of an entry", () => {
  const xml = (categories: string) =>
    `<feed><entry><id>https://sanch.pet/ru/notes/n</id>${categories}</entry></feed>`

  test("is read from the category with the kind scheme and is not a channel", () => {
    const [entry] = parseFeed(
      xml(`<category term="lytdybr"/><category scheme="${KIND_SCHEME}" term="note"/>`),
    ).entries
    assert.deepStrictEqual(entry.categories, ["lytdybr"])
    assert.strictEqual(entry.kind, "note")
  })

  test("a category of another scheme is neither a channel nor the species", () => {
    const [entry] = parseFeed(xml(`<category scheme="https://example.org/x" term="note"/>`)).entries
    assert.deepStrictEqual(entry.categories, [])
    assert.strictEqual(entry.kind, undefined)
  })
})
