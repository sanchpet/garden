import { resolveCursor, shouldDraw, type CursorMode } from "./cursor-state"

// The drawn cursor's page side. Listeners are set once, the script runs once per page load;
// `nav` (every page, the first included) re-reads the environment.

const html = document.documentElement
const media = (q: string) => window.matchMedia(q).matches

let layer: HTMLElement | null = null
let pointer: HTMLElement | null = null
let brackets: HTMLElement | null = null
let underlines: HTMLElement | null = null
let underlineTemplate: HTMLTemplateElement | null = null

let enabled = false
let x = 0
let y = 0
let hovered: Element | null = null
let stale = false
let frame = 0
let mode: CursorMode = "pencil"
let attached: Element | null = null

function environment() {
  return {
    finePointer: media("(pointer: fine)"),
    reducedData: media("(prefers-reduced-data: reduce)"),
    forcedColors: media("(forced-colors: active)"),
  }
}

// The layer lives on <html>, outside the body the SPA morphs, so it is built once.
function mount(): boolean {
  if (layer) return true
  const template = document.getElementById("drawn-cursor") as HTMLTemplateElement | null
  if (!template) return false
  layer = document.createElement("div")
  layer.className = "drawn-cursor"
  layer.setAttribute("aria-hidden", "true")
  layer.dataset.visible = "false"
  layer.dataset.mode = "pencil"
  layer.append(template.content.cloneNode(true))
  pointer = layer.querySelector(".dc-pointer")
  brackets = layer.querySelector(".dc-brackets")
  underlines = layer.querySelector(".dc-underlines")
  underlineTemplate = layer.querySelector("template.dc-underline")
  html.append(layer)
  return true
}

function release() {
  html.classList.remove("dc-on")
  attach("pencil", null)
  if (layer) layer.dataset.visible = "false"
}

function apply() {
  const env = environment()
  enabled = shouldDraw(env) && mount()
  if (!enabled) release()
}

function attach(next: CursorMode, target: Element | null) {
  if (attached !== target || mode !== next) {
    attached?.removeAttribute("data-dc-underlined")
    if (underlines) underlines.replaceChildren()
    if (brackets) brackets.dataset.on = "false"
    attached = target
    if (target && next === "underline")
      (target as HTMLElement).setAttribute("data-dc-underlined", "")
  }
  mode = next
}

function drawUnderline(link: Element) {
  if (!underlines || !underlineTemplate) return
  const rects = Array.from(link.getClientRects()).filter((r) => r.width > 0)
  const color = getComputedStyle(link).color
  while (underlines.children.length < rects.length) {
    const line = document.createElement("span")
    line.className = "dc-underline-line"
    line.append(underlineTemplate.content.cloneNode(true))
    underlines.append(line)
  }
  while (underlines.children.length > rects.length) underlines.lastElementChild!.remove()
  rects.forEach((r, i) => {
    const line = underlines!.children[i] as HTMLElement
    line.style.color = color
    line.style.width = `${r.width}px`
    line.style.transform = `translate3d(${r.left}px, ${r.bottom - 4}px, 0)`
  })
}

function drawBrackets(block: Element) {
  if (!brackets) return
  const r = block.getBoundingClientRect()
  const pad = 5
  brackets.style.width = `${r.width + pad * 2}px`
  brackets.style.height = `${r.height + pad * 2}px`
  brackets.style.transform = `translate3d(${r.left - pad}px, ${r.top - pad}px, 0)`
  brackets.dataset.on = "true"
}

function render() {
  frame = 0
  if (!enabled || !layer || !pointer) return
  if (stale) {
    hovered = document.elementFromPoint(x, y)
    stale = false
  }
  const { mode: next, target } = resolveCursor(hovered)
  attach(next, target)
  layer.dataset.mode = next

  let px = x
  let py = y
  if (next === "underline" && target) drawUnderline(target)
  if (next === "bracket" && target) {
    drawBrackets(target)
    // The point leans towards the block it frames, as if the pencil were drawn to it.
    const r = target.getBoundingClientRect()
    px += (r.left + r.width / 2 - x) * 0.15
    py += (r.top + r.height / 2 - y) * 0.15
  }
  pointer.style.transform = `translate3d(${px}px, ${py}px, 0)`
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(render)
}

function onMove(e: PointerEvent) {
  if (!enabled || !layer) return
  if (e.pointerType !== "mouse") {
    release()
    return
  }
  // Chrome's forecast of where the mouse is going trims the frame the drawing lags behind.
  const predicted = e.getPredictedEvents?.() ?? []
  const ahead = predicted[predicted.length - 1] ?? e
  x = ahead.clientX
  y = ahead.clientY
  hovered = e.target instanceof Element ? e.target : null
  // The system cursor goes only now, with the drawing in place to take over.
  html.classList.add("dc-on")
  layer.dataset.visible = "true"
  schedule()
}

document.addEventListener("pointermove", onMove, { passive: true })
document.addEventListener(
  "pointerout",
  (e) => {
    if (!e.relatedTarget && layer) layer.dataset.visible = "false"
  },
  { passive: true },
)
document.addEventListener("pointerdown", (e) => {
  if (enabled && layer && e.pointerType === "mouse") layer.dataset.pressed = "true"
})
document.addEventListener("pointerup", () => {
  if (layer) layer.dataset.pressed = "false"
})
// Under a still pointer the page moves on scroll, and so does what the pointer is over.
window.addEventListener(
  "scroll",
  () => {
    if (!enabled || !html.classList.contains("dc-on")) return
    stale = true
    schedule()
  },
  { passive: true, capture: true },
)

document.addEventListener("nav", () => {
  apply()
  // A new page under a still pointer: what it is over is no longer known.
  stale = true
  attach("pencil", null)
  schedule()
})
