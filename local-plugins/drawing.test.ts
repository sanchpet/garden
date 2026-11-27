import assert from "node:assert"
import test, { describe } from "node:test"
import { floor } from "./drawing"

describe("drawing width floor", () => {
  test("a narrow drawing shrinks to half its size", () => {
    assert.strictEqual(
      floor('<svg viewBox="0 0 668 390" width="668" height="390">'),
      ' style="--drawing-min: 334px"',
    )
  })

  test("a wide drawing or one without a width keeps the 720px floor", () => {
    assert.strictEqual(floor('<svg width="1188" height="1581">'), "")
    assert.strictEqual(floor('<svg viewBox="0 0 10 10">'), "")
  })
})
