import assert from "node:assert"
import { describe, test } from "node:test"
import vm from "node:vm"
import type { QuartzComponent } from "../quartz/components/types"
import { deferGraph, deferredScript } from "./graph"

const STOCK = `window.started = (window.started ?? 0) + 1`

// A browser just big enough for the schedule: load, idle callbacks, an observer per element.
function browser(opts: { readyState?: string; observer?: boolean } = {}) {
  const listeners = new Map<string, Array<() => void>>()
  const on = (type: string, fn: () => void) =>
    listeners.set(type, [...(listeners.get(type) ?? []), fn])
  const fire = (type: string) => (listeners.get(type) ?? []).forEach((fn) => fn())
  const idle: Array<() => void> = []
  const observers: Array<{ el: unknown; cb: (e: { isIntersecting: boolean }[]) => void }> = []
  let graph: object | null = { id: 1 }
  const document = {
    readyState: opts.readyState ?? "loading",
    querySelector: (sel: string) => (sel === ".graph" ? graph : null),
    addEventListener: on,
  }
  const window: Record<string, unknown> = {
    addEventListener: on,
    requestIdleCallback: (fn: () => void) => idle.push(fn),
  }
  if (opts.observer !== false) {
    window.IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      el: unknown = null
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        this.cb = cb
      }
      observe(el: unknown) {
        this.el = el
        observers.push(this)
      }
      disconnect() {
        const i = observers.indexOf(this)
        if (i >= 0) observers.splice(i, 1)
      }
    }
  }
  const context = vm.createContext({ window, document, setTimeout })
  context.requestIdleCallback = window.requestIdleCallback
  context.IntersectionObserver = window.IntersectionObserver
  vm.runInContext(deferredScript(STOCK), context)
  return {
    started: () => (window.started as number | undefined) ?? 0,
    fire,
    runIdle: () => idle.splice(0).forEach((fn) => fn()),
    observers,
    see: (el: unknown, visible: boolean) =>
      observers.filter((o) => o.el === el).forEach((o) => o.cb([{ isIntersecting: visible }])),
    graph: () => graph,
    swapGraph: () => (graph = { id: 2 }),
  }
}

describe("deferred graph", () => {
  test("waits for load, then idle, then the graph near the viewport", () => {
    const b = browser()
    assert.strictEqual(b.started(), 0)
    b.runIdle()
    assert.strictEqual(b.observers.length, 0, "no idle work is queued before load")
    b.fire("load")
    assert.strictEqual(b.observers.length, 0)
    b.runIdle()
    assert.strictEqual(b.observers.length, 1)
    b.see(b.graph(), false)
    assert.strictEqual(b.started(), 0)
    b.see(b.graph(), true)
    assert.strictEqual(b.started(), 1)
    assert.strictEqual(b.observers.length, 0, "the observer is let go once started")
  })

  test("starts once, whatever arrives afterwards", () => {
    const b = browser({ readyState: "complete" })
    b.runIdle()
    const first = b.graph()
    b.see(first, true)
    b.fire("nav")
    b.see(b.graph(), true)
    assert.strictEqual(b.started(), 1)
  })

  test("a page already loaded goes straight to idle", () => {
    const b = browser({ readyState: "complete" })
    b.runIdle()
    assert.strictEqual(b.observers.length, 1)
  })

  test("a navigation before the graph was reached watches the new page's graph", () => {
    const b = browser({ readyState: "complete" })
    b.runIdle()
    const old = b.graph()
    b.swapGraph()
    b.fire("nav")
    assert.deepStrictEqual(
      b.observers.map((o) => o.el),
      [b.graph()],
      "the old page's observer is dropped",
    )
    b.see(old, true)
    assert.strictEqual(b.started(), 0)
    b.see(b.graph(), true)
    assert.strictEqual(b.started(), 1)
  })

  test("without IntersectionObserver the graph starts when idle", () => {
    const b = browser({ readyState: "complete", observer: false })
    assert.strictEqual(b.started(), 0)
    b.runIdle()
    assert.strictEqual(b.started(), 1)
  })
})

describe("deferGraph", () => {
  const cdn = `e("https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js")`

  test("keeps the stock script verbatim, so self-hosting still finds the CDN addresses", () => {
    const graph = (() => null) as unknown as QuartzComponent
    graph.afterDOMLoaded = cdn
    deferGraph(graph)
    assert.ok((graph.afterDOMLoaded as string).includes(cdn))
    assert.notStrictEqual(graph.afterDOMLoaded, cdn)
  })

  test("defers the shared instance once across layouts", () => {
    const graph = (() => null) as unknown as QuartzComponent
    graph.afterDOMLoaded = cdn
    deferGraph(graph)
    const once = graph.afterDOMLoaded
    deferGraph(graph)
    assert.strictEqual(graph.afterDOMLoaded, once)
  })

  test("refuses a script it cannot wrap", () => {
    const graph = (() => null) as unknown as QuartzComponent
    graph.afterDOMLoaded = [cdn]
    assert.throws(() => deferGraph(graph), /cannot defer/)
  })
})
