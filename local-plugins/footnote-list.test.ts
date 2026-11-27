import assert from "node:assert"
import test, { describe } from "node:test"
import type { Element, Root } from "hast"
import { labelFootnotes } from "./footnote-list"

// The shape remark-rehype gives a page's footnotes.
function page(): { tree: Root; heading: Element; back: Element } {
  const heading: Element = {
    type: "element",
    tagName: "h2",
    properties: { className: ["sr-only"], id: "footnote-label" },
    children: [{ type: "text", value: "Footnotes" }],
  }
  const back: Element = {
    type: "element",
    tagName: "a",
    properties: { dataFootnoteBackref: "", ariaLabel: "Back to reference 2" },
    children: [{ type: "text", value: "↩" }],
  }
  const list: Element = { type: "element", tagName: "ol", properties: {}, children: [back] }
  const section: Element = {
    type: "element",
    tagName: "section",
    properties: { dataFootnotes: true, className: ["footnotes"] },
    children: [heading, list],
  }
  return { tree: { type: "root", children: [section] }, heading, back }
}

describe("footnote list heading", () => {
  test("is shown, and the way back named, in the page's language", () => {
    for (const [lang, label, backLabel] of [
      ["ru", "Примечания", "Вернуться к сноске 2"],
      ["en", "Notes", "Back to reference 2"],
    ] as const) {
      const { tree, heading, back } = page()
      labelFootnotes(tree, lang)
      assert.strictEqual(heading.properties.className, undefined)
      assert.deepStrictEqual(heading.children, [{ type: "text", value: label }])
      assert.strictEqual(heading.properties.id, "footnote-label")
      assert.strictEqual(back.properties.ariaLabel, backLabel)
    }
  })

  test("falls back to English outside the language folders", () => {
    const { tree, heading } = page()
    labelFootnotes(tree, undefined)
    assert.deepStrictEqual(heading.children, [{ type: "text", value: "Notes" }])
  })

  test("a page without footnotes is left alone", () => {
    const tree: Root = {
      type: "root",
      children: [{ type: "element", tagName: "h2", properties: {}, children: [] }],
    }
    const before = structuredClone(tree)
    labelFootnotes(tree, "ru")
    assert.deepStrictEqual(tree, before)
  })
})
