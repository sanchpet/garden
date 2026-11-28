import assert from "node:assert"
import test, { describe } from "node:test"
import { currentSection, dashPath, dashWidth, hasContents, readingLine } from "./dash-toc-logic"

describe("dash contents", () => {
  const entry = (depth: number) => ({ depth, text: "x", slug: "x" })

  test("two headings make contents, one does not", () => {
    assert.strictEqual(hasContents(undefined), false)
    assert.strictEqual(hasContents([entry(0)]), false)
    assert.strictEqual(hasContents([entry(0), entry(1)]), true)
  })

  test("a deeper heading gets a shorter dash, down to a stub", () => {
    assert.deepStrictEqual([0, 1, 2, 3, 6].map(dashWidth), [20, 15, 10, 8, 8])
  })

  test("a dash is the same stroke on every build and differs from its neighbour", () => {
    assert.strictEqual(dashPath(20, 3), dashPath(20, 3))
    assert.notStrictEqual(dashPath(20, 3), dashPath(20, 4))
    assert.ok(dashPath(20, 0).startsWith("M1 2.5"))
  })

  test("the reading line is a third down, and the screen's bottom at the page's end", () => {
    assert.strictEqual(readingLine(900, 0, 3000), 300)
    assert.strictEqual(readingLine(900, 2999, 3000), 900)
    assert.strictEqual(readingLine(900, 0, 0), 900)
  })

  test("the current section is the last heading above the reading line", () => {
    assert.strictEqual(currentSection([500, 900], 300), -1)
    assert.strictEqual(currentSection([-400, 120, 900], 300), 1)
    assert.strictEqual(currentSection([-900, -400, 300], 300), 2)
    assert.strictEqual(currentSection([], 300), -1)
  })
})
