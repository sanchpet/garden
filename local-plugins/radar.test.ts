import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { opensHere } from "./radar-click"
import { DOT, EDGE, RINGS, ageOf, overlaps, place, type Ring, type Seat } from "./radar-layout"

const quadrant = (i: number) => ({ from: 180 - i * 90, to: 90 - i * 90 })
const cell = (n: number, ring: Ring, q = 0): Seat[] =>
  Array.from({ length: n }, (_, i) => ({ path: `${ring}/${q}/tool-${i}`, ring, ...quadrant(q) }))

describe("place", () => {
  it("puts the same radar in the same places on every build", () => {
    const seats = [...cell(9, "adopt"), ...cell(6, "hold", 2)]
    assert.deepEqual([...place(seats)], [...place([...seats].reverse())])
  })

  // The adopt cell is the smallest in area; eleven dots is what it holds without touching.
  for (const [ring, n] of [
    ["adopt", 11],
    ["trial", 16],
    ["assess", 16],
    ["hold", 16],
  ] as const)
    it(`keeps ${n} dots in one ${ring} cell apart`, () => {
      assert.equal(overlaps(place(cell(n, ring)).values()), 0)
    })

  it("keeps every dot inside its ring and sector", () => {
    const seats = RINGS.flatMap((ring, i) => cell(10, ring, i))
    const placed = place(seats)
    for (const seat of seats) {
      const { r, deg } = placed.get(seat.path)!
      const [r0, r1] = EDGE[seat.ring]
      assert.ok(r >= r0 + DOT && r <= r1 - DOT, `${seat.path} r=${r}`)
      assert.ok(deg > seat.to && deg < seat.from, `${seat.path} deg=${deg}`)
    }
  })
})

describe("opensHere", () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
  it("takes a plain click", () => assert.equal(opensHere(click), true))
  for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)
    it(`leaves a click with ${key} to the browser`, () =>
      assert.equal(opensHere({ ...click, [key]: true }), false))
  it("leaves the middle button to the browser", () =>
    assert.equal(opensHere({ ...click, button: 1 }), false))
})

describe("ageOf", () => {
  const now = new Date("2026-11-28T03:00:00Z")
  it("marks a tool new for a quarter", () => {
    assert.equal(ageOf("2026-11-28", now), "new")
    assert.equal(ageOf(new Date("2026-08-31T00:00:00Z"), now), "new")
    assert.equal(ageOf("2026-08-30", now), undefined)
  })
  it("fades a place after a year", () => {
    assert.equal(ageOf("2025-11-29", now), undefined)
    assert.equal(ageOf("2025-11-28", now), "faded")
  })
  it("leaves a missing or future date unmarked", () => {
    assert.equal(ageOf(undefined, now), undefined)
    assert.equal(ageOf("someday", now), undefined)
    assert.equal(ageOf("2027-01-01", now), undefined)
  })
})
