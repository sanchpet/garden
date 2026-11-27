import assert from "node:assert"
import { describe, test } from "node:test"
import type { Paragraph, Root } from "mdast"
import { DROP_CAP, dropCapTarget, markDropCap } from "./dropcap"

const long = "У меня есть друг, который пару лет назад продал стартап и теперь богат. ".repeat(4)
const text = (value: string) => ({ type: "text" as const, value })
const para = (...children: Paragraph["children"]): Paragraph => ({ type: "paragraph", children })
const root = (...children: Root["children"]): Root => ({ type: "root", children })
const rule = { type: "thematicBreak" as const }

describe("dropCapTarget", () => {
  test("the opening paragraph of a text gets the drop cap", () => {
    const opening = para(text(long))
    const tree = root(opening, para(text(long)))
    markDropCap(tree)
    assert.deepStrictEqual(opening.data, { hProperties: { className: [DROP_CAP] } })
    assert.strictEqual((tree.children[1] as Paragraph).data, undefined)
  })

  test("a short preface before a rule leaves the drop cap to the text after it", () => {
    const after = para(text(long))
    assert.strictEqual(dropCapTarget(root(para(text("Автор статьи - не я.")), rule, after)), after)
  })

  test("an epigraph is not the text: the drop cap goes after it", () => {
    const after = para(text(long))
    const epigraph = { type: "blockquote" as const, children: [para(text(long))] }
    assert.strictEqual(dropCapTarget(root(epigraph, after)), after)
  })

  test("no drop cap on a short opening, a quotation mark, a dash, a link, a heading or a list", () => {
    const cases: Root[] = [
      root(para(text("Короткое начало."))),
      root(para(text(`«${long}`))),
      root(para(text(`— ${long}`))),
      root(para({ type: "link", url: "x", children: [text(long)] })),
      root({ type: "heading", depth: 2, children: [text("Раздел")] }, para(text(long))),
      root({ type: "list", children: [] }, para(text(long))),
    ]
    for (const tree of cases) assert.strictEqual(dropCapTarget(tree), undefined)
  })
})
