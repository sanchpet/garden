import assert from "node:assert"
import test, { describe } from "node:test"
import { fingerOwner } from "./bookcase-touch"

describe("bookcase finger owner", () => {
  test("a sideways or slanted first move belongs to the case", () => {
    assert.strictEqual(fingerOwner(6, 0), "case")
    assert.strictEqual(fingerOwner(-5, 4), "case")
    assert.strictEqual(fingerOwner(3, 4), "case")
  })

  test("a clearly vertical first move belongs to the page", () => {
    assert.strictEqual(fingerOwner(0, 8), "page")
    assert.strictEqual(fingerOwner(2, -9), "page")
  })
})
