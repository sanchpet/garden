import assert from "node:assert"
import { describe, test } from "node:test"
import type { Paragraph, Root } from "mdast"
import { splitLines } from "./paragraphs"

const text = (value: string) => ({ type: "text" as const, value })
const para = (...children: Paragraph["children"]): Paragraph => ({ type: "paragraph", children })
const root = (...children: Root["children"]): Root => ({ type: "root", children })

describe("splitLines", () => {
  test("each line of a paragraph becomes a paragraph", () => {
    const tree = root(para(text("first line\nsecond line\n\nthird")))
    splitLines(tree)
    assert.deepStrictEqual(
      tree,
      root(para(text("first line")), para(text("second line")), para(text("third"))),
    )
  })

  test("a single-line paragraph is unchanged", () => {
    const tree = root(para(text("one line only")))
    const before = structuredClone(tree)
    splitLines(tree)
    assert.deepStrictEqual(tree, before)
  })

  test("links, embeds and code stay whole and go with their line", () => {
    const link = { type: "link" as const, url: "ru/x", children: [text("a\nb")] }
    const embed = { type: "image" as const, url: "media/a.png" }
    const code = { type: "inlineCode" as const, value: "x\ny" }
    const tree = root(para(text("see "), link, text(" here\nthen "), code, text(" and\n"), embed))
    splitLines(tree)
    assert.deepStrictEqual(
      tree,
      root(
        para(text("see "), link, text(" here")),
        para(text("then "), code, text(" and")),
        para(embed),
      ),
    )
  })

  test("quotations, callouts, lists and code keep their lines", () => {
    const quote = { type: "blockquote" as const, children: [para(text("a\nb"))] }
    const list = {
      type: "list" as const,
      children: [{ type: "listItem" as const, children: [para(text("c\nd"))] }],
    }
    const block = { type: "code" as const, value: "e\nf" }
    const tree = root(quote, list, block)
    const before = structuredClone(tree)
    splitLines(tree)
    assert.deepStrictEqual(tree, before)
  })
})
