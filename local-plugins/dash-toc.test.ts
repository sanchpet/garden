import assert from "node:assert"
import test, { describe } from "node:test"
import {
  bell,
  currentSection,
  dashPath,
  dockLengths,
  dockZone,
  dockOpacity,
  hasContents,
  nearestIndex,
  readingLine,
  REST_LENGTH,
  restLengths,
} from "./dash-toc-logic"

describe("dash contents", () => {
  const entry = (depth: number) => ({ depth, text: "x", slug: "x" })

  test("two headings make contents, one does not", () => {
    assert.strictEqual(hasContents(undefined), false)
    assert.strictEqual(hasContents([entry(0)]), false)
    assert.strictEqual(hasContents([entry(0), entry(1)]), true)
  })

  test("every dash rests at one length whatever its heading's level", () => {
    const lengths = restLengths([entry(0), entry(1), entry(2), entry(3)])
    assert.deepStrictEqual(lengths, [REST_LENGTH, REST_LENGTH, REST_LENGTH, REST_LENGTH])
  })

  test("the dock stays open across the strip and rightwards over the longest stroke", () => {
    const zone = dockZone({ left: 300, top: 100, bottom: 220 }, 118)
    assert.deepStrictEqual(zone, { left: 284, right: 434, top: 88, bottom: 232 })
    assert.ok(zone.right > 300 + 118, "the zone reaches past the longest stroke's tip")
    assert.ok(zone.left > 300 - 118, "nothing to the strip's left keeps the dock")
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

  test("under the pointer the strokes swell in a bell, the nearest the most", () => {
    const centres = [6, 18, 30, 42, 54]
    const rests = centres.map(() => REST_LENGTH)
    const lengths = dockLengths(rests, centres, 30)
    assert.strictEqual(lengths[2], REST_LENGTH + 100)
    assert.ok(lengths[1] > REST_LENGTH && lengths[1] < lengths[2])
    assert.ok(lengths[3] < lengths[2] && lengths[3] > lengths[4])
    assert.ok(Math.abs(lengths[1] - lengths[3]) < 1e-9, "the bell is symmetric")
    assert.ok(
      dockLengths(rests, centres, 330).every((l) => l - REST_LENGTH < 0.01),
      "far: at rest",
    )
    assert.strictEqual(bell(0), 1)
    assert.ok(bell(30) > 0.6 && bell(30) < 0.61)
  })

  test("the nearest stroke is the closest centre, the first of a tie", () => {
    assert.strictEqual(nearestIndex([6, 18, 30], 20), 1)
    assert.strictEqual(nearestIndex([6, 18, 30], -50), 0)
    assert.strictEqual(nearestIndex([6, 18, 30], 500), 2)
    assert.strictEqual(nearestIndex([6, 18], 12), 0)
    assert.strictEqual(nearestIndex([], 12), -1)
  })

  test("the nearest stroke is full ink, the others fade with distance", () => {
    assert.strictEqual(dockOpacity(0.2, true), 1)
    assert.ok(dockOpacity(1, false) > dockOpacity(0.5, false))
    assert.strictEqual(dockOpacity(0, false), 0.3)
  })

  test("the current section is the last heading above the reading line", () => {
    assert.strictEqual(currentSection([500, 900], 300), -1)
    assert.strictEqual(currentSection([-400, 120, 900], 300), 1)
    assert.strictEqual(currentSection([-900, -400, 300], 300), 2)
    assert.strictEqual(currentSection([], 300), -1)
  })
})
