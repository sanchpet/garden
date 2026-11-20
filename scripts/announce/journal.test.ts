import assert from "node:assert"
import test, { describe } from "node:test"
import {
  ANY_CHANNEL,
  emptyJournal,
  isDelivered,
  isEmpty,
  mergeJournals,
  parseJournal,
  record,
  serializeJournal,
  type Delivery,
} from "./journal"

const sent: Delivery = { at: "2026-11-20T00:00:00.000Z", origin: "sent", messageId: 7 }

describe("journal", () => {
  test("a record is per entry and channel, and does not change its input", () => {
    const before = emptyJournal()
    const after = record(before, "a", "blog", sent)
    assert.ok(isEmpty(before))
    assert.ok(isDelivered(after, "a", "blog"))
    assert.ok(!isDelivered(after, "a", "hub"))
    assert.ok(!isDelivered(after, "b", "blog"))
  })

  test("a seeded entry is delivered for every channel", () => {
    const journal = record(emptyJournal(), "a", ANY_CHANNEL, { ...sent, origin: "seeded" })
    assert.ok(isDelivered(journal, "a", "anything"))
  })

  test("survives a round trip and is written in a stable order", () => {
    const journal = record(record(emptyJournal(), "b", "blog", sent), "a", "blog", sent)
    const text = serializeJournal(journal)
    assert.deepStrictEqual(parseJournal(text), journal)
    assert.ok(text.indexOf('"a"') < text.indexOf('"b"'))
    assert.ok(text.endsWith("}\n"))
  })

  test("refuses a file that is not a journal", () => {
    assert.throws(() => parseJournal("[]"))
    assert.throws(() => parseJournal("not json"))
  })

  test("merging keeps both sides, ours on top", () => {
    const theirs = record(record(emptyJournal(), "a", "blog", sent), "b", "blog", sent)
    const ours = record(emptyJournal(), "a", "hub", { ...sent, messageId: 9 })
    const merged = mergeJournals(theirs, ours)
    assert.deepStrictEqual(Object.keys(merged.delivered.a).sort(), ["blog", "hub"])
    assert.ok(isDelivered(merged, "b", "blog"))
  })
})
