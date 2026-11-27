import assert from "node:assert"
import test, { describe } from "node:test"
import { resolveCursor, shouldDraw } from "./cursor-state"
import { cursorForms } from "./cursor-forms"

// A stand-in for an element: `closest` answers from the selectors it is declared to match,
// in the shape the page has (a link inside a paragraph of the article, and so on).
class Node {
  constructor(
    readonly name: string,
    readonly matches: (selector: string) => boolean,
    readonly parent: Node | null = null,
  ) {}
  closest(selector: string): Node | null {
    for (let at: Node | null = this; at; at = at.parent) {
      if (selector.split(/,(?![^(]*\))/).some((s) => at!.matches(s.trim()))) return at
    }
    return null
  }
}

const is =
  (...selectors: string[]) =>
  (selector: string) =>
    selectors.includes(selector)
const PROSE =
  "article :is(p, li, dd, dt, td, th, blockquote, figcaption, pre, h1, h2, h3, h4, h5, h6)"

describe("resolveCursor", () => {
  const paragraph = new Node("p", is(PROSE))
  const inline = new Node("a", is("a[href]", PROSE), paragraph)

  test("a pencil over nothing in particular", () => {
    assert.strictEqual(resolveCursor(new Node("div", is())).mode, "pencil")
    assert.strictEqual(resolveCursor(null).mode, "pencil")
  })

  test("the pencil stays over running text and fields", () => {
    assert.strictEqual(resolveCursor(paragraph).mode, "pencil")
    assert.strictEqual(resolveCursor(new Node("textarea", is("textarea"))).mode, "pencil")
  })

  test("a link in the text is underlined, not framed", () => {
    assert.deepStrictEqual(resolveCursor(inline), { mode: "underline", target: inline })
  })

  test("a control outside the text is framed, with its row when it has one", () => {
    const row = new Node("li", is("li.section-li"))
    const link = new Node("a", is("a[href]"), row)
    assert.deepStrictEqual(resolveCursor(link), { mode: "bracket", target: row })
    const button = new Node("button", is("button:not(:disabled)"))
    assert.deepStrictEqual(resolveCursor(button), { mode: "bracket", target: button })
  })

  test("a button inside a code block is framed", () => {
    const pre = new Node("pre", is(PROSE))
    const copy = new Node("button", is("button:not(:disabled)"), pre)
    assert.strictEqual(resolveCursor(copy).mode, "bracket")
  })

  test("a drawn link takes the marker, a footnote mark the question", () => {
    const book = new Node("a", is("a.bookcase-book", "a[href]"))
    assert.strictEqual(resolveCursor(book).mode, "marker")
    const mark = new Node("a", is("a[data-footnote-ref]", "a[href]", PROSE), paragraph)
    assert.strictEqual(resolveCursor(mark).mode, "help")
  })

  test("the radar's scope takes the crosshair, its blips the marker", () => {
    const scope = new Node("svg", is(".radar-scope"))
    assert.strictEqual(resolveCursor(new Node("path", is(), scope)).mode, "crosshair")
    assert.strictEqual(
      resolveCursor(new Node("a", is("a.radar-blip", "a[href]"), scope)).mode,
      "marker",
    )
  })
})

describe("shouldDraw", () => {
  const mouse = {
    finePointer: true,
    reducedData: false,
    forcedColors: false,
  } as const

  test("draws for a mouse by default", () => {
    assert.strictEqual(shouldDraw(mouse), true)
  })

  test("each guard alone keeps the system cursor", () => {
    assert.strictEqual(shouldDraw({ ...mouse, finePointer: false }), false)
    assert.strictEqual(shouldDraw({ ...mouse, reducedData: true }), false)
    assert.strictEqual(shouldDraw({ ...mouse, forcedColors: true }), false)
  })
})

describe("cursorForms", () => {
  test("a build repeats itself", () => {
    assert.deepStrictEqual(cursorForms(), cursorForms())
  })

  test("another seed draws other strokes", () => {
    assert.notDeepStrictEqual(cursorForms(1).pencil, cursorForms(2).pencil)
  })

  test("every form is a finite drawing with its hotspot inside it", () => {
    const forms = cursorForms()
    for (const [name, form] of Object.entries(forms)) {
      const svgs = typeof form === "string" ? [form] : Array.isArray(form) ? form : [form.svg]
      for (const svg of svgs) assert.doesNotMatch(svg, /NaN|Infinity|undefined/, name)
      if (typeof form === "object" && !Array.isArray(form)) {
        const size = Number(/width="(\d+)"/.exec(form.svg)![1])
        for (const v of form.hotspot) assert.ok(v >= 0 && v <= size, `${name} hotspot ${v}`)
      }
    }
    const size = Number(/width="(\d+)"/.exec(forms.pencil.svg)![1])
    const [tx, ty] = forms.pencil.hotspot
    assert.ok(tx < size / 2 && ty > size / 2, "the pencil's point is at its lower left")
    assert.strictEqual(forms.corners.length, 4)
    assert.strictEqual(new Set(forms.corners).size, 4)
  })
})
