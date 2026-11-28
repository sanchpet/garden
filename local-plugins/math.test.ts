import assert from "node:assert"
import { describe, test } from "node:test"
import type { Element, Root } from "hast"
import { render } from "preact-render-to-string"
import type { JSX } from "preact"
import type { QuartzTransformerPluginInstance } from "../quartz/plugins/types"
import type { QuartzPluginData } from "../quartz/plugins/vfile"
import type { BuildCtx } from "../quartz/util/ctx"
import { hasMath, loaderFor, mathOnlyWhereUsed } from "./math"

const CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
const JS = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/copy-tex.min.js"

// The shape of @quartz-community/latex with the katex engine.
const latex: QuartzTransformerPluginInstance = {
  name: "Latex",
  htmlPlugins: () => [],
  externalResources: () => ({
    css: [{ content: CSS }],
    js: [{ src: JS, loadTime: "afterDOMReady", contentType: "external" }],
  }),
}

const span = (className: string[], children: Element[] = []): Element => ({
  type: "element",
  tagName: "span",
  properties: { className },
  children,
})
const root = (...children: Element[]): Root => ({ type: "root", children })

const ctx = {} as BuildCtx
const resources = () => mathOnlyWhereUsed(latex).externalResources!(ctx)!
const head = (page: Partial<QuartzPluginData>) =>
  resources()
    .additionalHead!.map((el) =>
      render((typeof el === "function" ? el(page as QuartzPluginData) : el) as JSX.Element),
    )
    .join("")

describe("hasMath", () => {
  test("a rendered formula, however deep, counts", () => {
    assert.strictEqual(
      hasMath(root(span(["para"], [span(["katex-display"], [span(["katex"])])]))),
      true,
    )
  })

  test("a page without one does not", () => {
    assert.strictEqual(hasMath(root(span(["katex-like"]), span(["para"]))), false)
  })
})

describe("mathOnlyWhereUsed", () => {
  test("nothing of KaTeX is declared for every page", () => {
    const res = resources()
    assert.deepStrictEqual(res.css, [])
    assert.ok(res.js!.every((r) => r.contentType === "inline"))
  })

  test("a page with a formula links the stylesheet in its head", () => {
    assert.ok(head({ math: true }).includes(`<link rel="stylesheet" href="${CSS}"`))
  })

  test("a page without one links nothing", () => {
    assert.doesNotMatch(head({ math: false }), /katex/)
    assert.doesNotMatch(head({}), /katex/)
  })

  test("the copy script is fetched by the loader, which waits for a formula", () => {
    const loader = resources().js!.find((r) => r.contentType === "inline")
    assert.ok(loader && loader.contentType === "inline")
    assert.strictEqual(loader.loadTime, "afterDOMReady")
    // Literal, so that the self-host step finds and rewrites the CDN address.
    assert.ok(loader.script.includes(JS))
    assert.ok(!loader.script.includes("</"), "a script-ending sequence survives in the loader")
    assert.ok(loader.script.includes('querySelector(".katex")'))
  })

  test("the page is marked after KaTeX has rendered", () => {
    const plugins = mathOnlyWhereUsed(latex).htmlPlugins!(ctx)
    const mark = (plugins.at(-1) as () => (tree: Root, file: { data: QuartzPluginData }) => void)()
    const file = { data: {} as QuartzPluginData }
    mark(root(span(["katex"])), file)
    assert.strictEqual(file.data.math, true)
  })
})

describe("loaderFor", () => {
  test("runs once per page load, not once per navigation", () => {
    assert.match(loaderFor([JS]), /window\.__mathScripts\|\|/)
  })
})

describe("loaderFor escaping", () => {
  test("an address cannot close the script it is written into", () => {
    const script = loaderFor(["/x</script><script>alert(1)</script>"])
    assert.ok(!script.includes("</script>"))
    assert.ok(script.includes("\\u003c/script\\u003e"))
  })
})
