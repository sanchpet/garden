import type { QuartzComponent } from "../quartz/components/types"

// d3 and pixi.js (about 340 KB) start after load, once the browser is idle and the graph is
// within a screen of the viewport: a phone reader who never scrolls under the text never fetches them.
const SCHEDULE = `
let started = false
let observer
const go = () => {
  started = true
  observer?.disconnect()
  startGraph()
}
const watch = () => {
  if (started) return
  const graph = document.querySelector(".graph")
  if (!graph) return
  if (!("IntersectionObserver" in window)) return go()
  observer?.disconnect()
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) go()
  }, { rootMargin: "100% 0px" })
  observer.observe(graph)
}
const arm = () => {
  document.addEventListener("nav", watch)
  watch()
}
const idle = () =>
  "requestIdleCallback" in window ? requestIdleCallback(arm, { timeout: 2000 }) : setTimeout(arm, 200)
if (document.readyState === "complete") idle()
else window.addEventListener("load", idle, { once: true })
`

export function deferredScript(stock: string): string {
  return `const startGraph = () => {\n${stock}\n}\n${SCHEDULE}`
}

// Changed in place: the component registry hands the same instance to every layout and also
// lists it on its own, so a wrapper would leave the stock script in the bundle.
const deferred = new WeakSet<QuartzComponent>()

export function deferGraph(graph: QuartzComponent): void {
  if (deferred.has(graph)) return
  if (typeof graph.afterDOMLoaded !== "string") {
    throw new Error("garden: the graph's script is not a single string; cannot defer it")
  }
  graph.afterDOMLoaded = deferredScript(graph.afterDOMLoaded)
  deferred.add(graph)
}
