import test, { describe } from "node:test"
import assert from "node:assert"
import { isSource, isText, isUnknownType, kindOf } from "./kinds"

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
  test("any value that is not a registered species is unknown, whatever its YAML type", () => {
    for (const type of ["source", "Book", " post", 42, 0, false, ["post"], [], { a: 1 }]) {
      assert.strictEqual(isUnknownType(type), true, JSON.stringify(type))
    }
  })

  test("registered species and pages without a type are silent", () => {
    for (const type of ["post", "platform", "races", undefined, null, "", "  "]) {
      assert.strictEqual(isUnknownType(type), false, JSON.stringify(type))
    }
  })
})
