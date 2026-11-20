import assert from "node:assert"
import test, { describe } from "node:test"
import { parseFeed, telegramPost } from "./feed"
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
      published: "2026-11-05T00:00:00Z",
      updated: "2026-11-05T00:00:00Z",
      categories: ["lytdybr"],
      related: ["https://t.me/sanchpetlytdybr/334"],
    })
  })

  test("decodes character references", () => {
    const entry = fixture()[1]
    assert.strictEqual(entry.title, "Мышление & <практика>")
    assert.strictEqual(entry.summary, "Что есть мышление & зачем учиться мыслить — коротко.")
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
