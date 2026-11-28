import test, { describe } from "node:test"
import assert from "node:assert"
import type { BasesEntry } from "@quartz-community/bases-page"
import { grouped, ownLanguage, sectionNames } from "./bookcase/shelving"
import { fillFromTwin, twinFiles } from "./twins"

const card = (slug: string, properties: Record<string, unknown>) =>
  ({ slug, title: slug, properties, fileProperties: {}, formulaValues: {} }) as BasesEntry

describe("catalogue twins", () => {
  test("a translated card takes the reading state it lacks from its twin", () => {
    const ru = { type: "book", status: "done", finished: "2026-11-22", cover: "[[c.jpg]]" }
    const en = { type: "book", description: "English", status: null }
    assert.deepStrictEqual(fillFromTwin(en, ru), {
      type: "book",
      description: "English",
      status: "done",
      finished: "2026-11-22",
      cover: "[[c.jpg]]",
    })
  })

  test("what the card says itself is kept, and words are never shared", () => {
    const ru = { status: "done", category: "экономика", description: "Русский", year: 2015 }
    const en = { status: "later", category: "economics", description: "English" }
    assert.deepStrictEqual(fillFromTwin(en, ru), { ...en, year: 2015 })
  })

  test("the twin is the same file under the other language", () => {
    assert.deepStrictEqual(twinFiles("en/library/misbehaving.md"), ["ru/library/misbehaving.md"])
    assert.deepStrictEqual(twinFiles("library/misbehaving.md"), [])
  })

  test("a card shown on the other language's shelf joins the translated section", () => {
    const entries = [
      card("ru/library/a", { category: "экономика" }),
      card("en/library/a", { category: "economics" }),
      card("ru/library/b", { category: "экономика" }),
      card("ru/library/c", { category: "биографии" }),
    ]
    const names = sectionNames(entries, "note.category", "en")
    assert.deepStrictEqual([...names], [["экономика", "economics"]])
    const groups = grouped(ownLanguage(entries, "en"), "category", false, names)
    assert.deepStrictEqual(
      groups.map((g) => [g.label, g.books.map((b) => b.path)]),
      [
        ["economics", ["library/a", "library/b"]],
        ["биографии", ["library/c"]],
      ],
    )
  })

  test("a shelf in the cards' own language keeps their names", () => {
    const entries = [
      card("ru/library/a", { category: "экономика" }),
      card("en/library/a", { category: "economics" }),
    ]
    const groups = grouped(
      ownLanguage(entries, "ru"),
      "category",
      false,
      sectionNames(entries, "category", "ru"),
    )
    assert.deepStrictEqual(
      groups.map((g) => g.label),
      ["экономика"],
    )
  })
})
