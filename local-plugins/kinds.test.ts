import test, { describe } from "node:test"
import assert from "node:assert"
import { isSource, isText, kindOf, unknownType } from "./kinds"

describe("kinds registry", () => {
  test("every species belongs to its kind", () => {
    assert.deepStrictEqual(["post", "evergreen"].map(kindOf), ["text", "text"])
    assert.deepStrictEqual(
      ["book", "course", "guide", "platform"].map(kindOf),
      Array(4).fill("source"),
    )
    assert.strictEqual(kindOf("tool"), "assessed")
    assert.strictEqual(kindOf("races"), "module")
  })

  test("a text is not a source and a source is not a text", () => {
    assert.ok(isText("post") && !isSource("post"))
    assert.ok(isSource("guide") && !isText("guide"))
    assert.ok(!isText("tool") && !isSource("races"))
  })

  test("values outside the registry have no kind", () => {
    for (const type of [undefined, null, "", "source", "Book", 7, ["book"], "constructor"]) {
      assert.strictEqual(kindOf(type), undefined)
    }
  })
})

describe("unknown types", () => {
  test("a non-empty string absent from the registry is reported as written", () => {
    assert.strictEqual(unknownType("source"), "source")
    assert.strictEqual(unknownType("Book"), "Book")
  })

  test("registered species and pages without a type are silent", () => {
    for (const type of ["post", "platform", "races", undefined, null, "", "  ", 7, ["x"]]) {
      assert.strictEqual(unknownType(type), undefined)
    }
  })
})
