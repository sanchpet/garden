import { opensHere } from "./radar-click"
import { labelSpot, tapOpens } from "./radar-hover"
import { DOT } from "./radar-layout"

// A blip or its row in the list, the two ends of one tool.
const ITEM = ".radar-blip, .radar-ring li[data-n]"
const EDGE = 6

let pointer = ""
let shown: Element | null = null

const itemOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest(ITEM) : null

// Lights tool `n` on its radar: its blip, row, sector and ring stay, the rest steps back.
function light(radar: Element, n?: string) {
  const blip = n ? radar.querySelector(`.radar-blip[data-n="${n}"]`) : null
  const sector = blip?.getAttribute("data-sector")
  const ring = blip?.getAttribute("data-ring")
  radar.classList.toggle("is-focus", blip !== null)
  for (const el of radar.querySelectorAll(ITEM))
    el.classList.toggle("is-on", blip !== null && el.getAttribute("data-n") === n)
  for (const el of radar.querySelectorAll(".radar-veil, .radar-sector"))
    el.classList.toggle("is-on", el.getAttribute("data-sector") === sector)
  for (const el of radar.querySelectorAll(".radar-step"))
    el.classList.toggle("is-on", el.getAttribute("data-ring") === ring)
  label(radar, blip)
  shown = blip
}

function label(radar: Element, blip: Element | null) {
  const chip = radar.querySelector<HTMLElement>(".radar-label")
  const scope = radar.querySelector<SVGSVGElement>(".radar-scope")
  if (!chip || !scope) return
  if (!blip) {
    chip.hidden = true
    return
  }
  chip.querySelector(".radar-label-name")!.textContent = blip.getAttribute("data-name")
  chip.querySelector(".radar-label-note")!.textContent = blip.getAttribute("data-note")
  chip.hidden = false
  const number = blip.querySelector(".radar-number")!.getBoundingClientRect()
  // The dot grows under the pointer; the label keeps its distance from the grown one.
  const r = 1.25 * (DOT + 2) * (scope.getBoundingClientRect().width / scope.viewBox.baseVal.width)
  const [x, y] = [number.left + number.width / 2, number.top + number.height / 2]
  const stage = radar.getBoundingClientRect()
  const left = Math.max(stage.left, 0) + EDGE
  const spot = labelSpot(
    { left: x - r, top: y - r, width: 2 * r, height: 2 * r },
    { width: chip.offsetWidth, height: chip.offsetHeight },
    {
      left,
      top: EDGE,
      width: Math.min(stage.right, document.documentElement.clientWidth) - EDGE - left,
      height: window.innerHeight - 2 * EDGE,
    },
  )
  chip.classList.toggle("is-below", spot.below)
  chip.style.left = `${spot.left - stage.left}px`
  chip.style.top = `${spot.top - stage.top}px`
  chip.style.setProperty("--tip", `${spot.tip}px`)
}

function clear() {
  const radar = shown?.closest(".radar")
  if (radar) light(radar)
}

document.addEventListener("pointerdown", (event) => (pointer = event.pointerType), true)

document.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch") return
  const item = itemOf(event.target)
  if (item) light(item.closest(".radar")!, item.getAttribute("data-n") ?? undefined)
})

document.addEventListener("pointerout", (event) => {
  if (event.pointerType === "touch") return
  const item = itemOf(event.target)
  if (item && itemOf(event.relatedTarget) !== item) light(item.closest(".radar")!)
})

document.addEventListener("focusin", (event) => {
  // A tapped link takes focus too; the tap itself decides what a finger sees.
  if (pointer === "touch") return
  const item = itemOf(event.target)
  if (item) light(item.closest(".radar")!, item.getAttribute("data-n") ?? undefined)
})

document.addEventListener("focusout", (event) => {
  if (itemOf(event.target) && !itemOf(event.relatedTarget)) clear()
})

document.addEventListener("keydown", (event) => {
  pointer = ""
  if (event.key === "Escape") clear()
})

// A phone's toolbar resizes the window on scroll; only a new width moves the dots.
let width = window.innerWidth
window.addEventListener("resize", () => {
  if (window.innerWidth !== width) clear()
  width = window.innerWidth
})
document.addEventListener("nav", () => (shown = null))

// A blip is an SVG link, whose href the SPA router cannot read (an SVGAnimatedString), so it
// would reload the page; a plain click on it goes through the router instead.
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return
  const link = event.target.closest("a.radar-blip")
  // A keyboard's click has no detail; only a real tap counts as a finger.
  const touch = pointer === "touch" && event.detail > 0
  if (!(link instanceof SVGAElement)) {
    if (touch && shown && !event.target.closest(ITEM)) clear()
    return
  }
  if (!tapOpens(touch, shown, link)) {
    event.preventDefault()
    light(link.closest(".radar")!, link.getAttribute("data-n") ?? undefined)
    return
  }
  if (!opensHere(event)) return
  event.preventDefault()
  window.spaNavigate(new URL(link.href.baseVal, window.location.href))
})
