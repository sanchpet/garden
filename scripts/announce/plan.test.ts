import assert from "node:assert"
import test, { describe } from "node:test"
import type { FeedEntry } from "./feed"
import { fixture } from "./fixtures/load"
import { ANY_CHANNEL, emptyJournal, isDelivered, record } from "./journal"
import { plan, seed } from "./plan"

const NOW = "2026-11-20T00:00:00.000Z"
const channels = { lytdybr: { chat: "@sanchpetlytdybr" }, sanchpetblog: { chat: "@sanchpetblog" } }
const entry = (over: Partial<FeedEntry>): FeedEntry => ({
  id: "https://sanch.pet/ru/posts/a",
  title: "A",
  categories: ["sanchpetblog"],
  related: [],
  ...over,
})
// A journal that is not empty, so that planning is what a real second run does.
const journal = record(emptyJournal(), "https://sanch.pet/old", ANY_CHANNEL, {
  at: NOW,
  origin: "seeded",
})
const targets = (entries: FeedEntry[], from = journal) =>
  plan(entries, from, channels, NOW).sends.map((send) => `${send.entry.id} ${send.chat.chat}`)

describe("seed", () => {
  test("records every entry as delivered, with the hand-made post where the feed has one", () => {
    const seeded = seed(fixture(), NOW)
    assert.strictEqual(Object.keys(seeded.delivered).length, 4)
    assert.deepStrictEqual(seeded.delivered["https://sanch.pet/ru/posts/za-sekundu"], {
      [ANY_CHANNEL]: { at: NOW, origin: "seeded", url: "https://t.me/sanchpetlytdybr/334" },
    })
    assert.deepStrictEqual(plan(fixture(), seeded, channels, NOW).sends, [])
  })
})

describe("plan", () => {
  test("a new entry goes to each of its channels", () => {
    assert.deepStrictEqual(targets([entry({ categories: ["sanchpetblog", "lytdybr"] })]), [
      "https://sanch.pet/ru/posts/a @sanchpetblog",
      "https://sanch.pet/ru/posts/a @sanchpetlytdybr",
    ])
  })

  test("an entry without categories is not announced", () => {
    assert.deepStrictEqual(targets([entry({ categories: [] })]), [])
  })

  test("an entry already in the journal is not announced, per channel", () => {
    const e = entry({ categories: ["sanchpetblog", "lytdybr"] })
    const delivered = record(journal, e.id, "sanchpetblog", { at: NOW, origin: "sent" })
    assert.deepStrictEqual(targets([e], delivered), [
      "https://sanch.pet/ru/posts/a @sanchpetlytdybr",
    ])
  })

  test("a related Telegram post means delivered, and is recorded with its address", () => {
    const e = entry({ related: ["https://t.me/sanchpetblog/361"] })
    const result = plan([e], journal, channels, NOW)
    assert.deepStrictEqual(result.sends, [])
    assert.deepStrictEqual(result.recorded, [
      { id: e.id, channel: "sanchpetblog", url: "https://t.me/sanchpetblog/361" },
    ])
    assert.deepStrictEqual(result.journal.delivered[e.id].sanchpetblog, {
      at: NOW,
      origin: "related",
      url: "https://t.me/sanchpetblog/361",
    })
    assert.deepStrictEqual(plan([e], result.journal, channels, NOW).recorded, [])
  })

  test("a changed `updated` does not announce an edition", () => {
    const first = entry({ updated: "2026-11-01T00:00:00Z" })
    const delivered = record(journal, first.id, "sanchpetblog", { at: NOW, origin: "sent" })
    assert.deepStrictEqual(targets([{ ...first, updated: "2026-11-19T00:00:00Z" }], delivered), [])
  })

  test("an unknown channel is skipped with a warning, the others still go", () => {
    const result = plan([entry({ categories: ["nowhere", "lytdybr"] })], journal, channels, NOW)
    assert.strictEqual(result.sends.length, 1)
    assert.strictEqual(result.sends[0].channel, "lytdybr")
    assert.match(result.warnings[0], /unknown channel "nowhere"/)
    assert.ok(!isDelivered(result.journal, "https://sanch.pet/ru/posts/a", "nowhere"))
  })

  test("the oldest text is announced first", () => {
    const newer = entry({ id: "https://sanch.pet/b", published: "2026-11-19T00:00:00Z" })
    const older = entry({ id: "https://sanch.pet/a", published: "2026-11-18T00:00:00Z" })
    assert.deepStrictEqual(targets([newer, older]), [
      "https://sanch.pet/a @sanchpetblog",
      "https://sanch.pet/b @sanchpetblog",
    ])
  })
})
