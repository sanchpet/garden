// Hovering or focusing a footnote mark shows that footnote's text beside it.
const HIDE_DELAY_MS = 150
let tip: HTMLElement | null = null
let hideTimer: number | undefined

function hide() {
  window.clearTimeout(hideTimer)
  tip?.remove()
  tip = null
}

function hideSoon() {
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(hide, HIDE_DELAY_MS)
}

function place(el: HTMLElement, ref: HTMLElement) {
  const margin = 8
  const r = ref.getBoundingClientRect()
  const w = el.offsetWidth
  const h = el.offsetHeight
  const left = Math.min(
    Math.max(margin, r.left + r.width / 2 - w / 2),
    document.documentElement.clientWidth - w - margin,
  )
  const top = r.top - h - margin >= 0 ? r.top - h - margin : r.bottom + margin
  el.style.left = `${left + window.scrollX}px`
  el.style.top = `${top + window.scrollY}px`
}

function show(ref: HTMLAnchorElement) {
  const note = document.getElementById(decodeURIComponent(ref.hash.slice(1)))
  if (!note) return
  hide()
  const body = note.cloneNode(true) as HTMLElement
  body.querySelectorAll("[data-footnote-backref]").forEach((el) => el.remove())
  tip = document.createElement("div")
  tip.className = "footnote-tooltip"
  tip.setAttribute("role", "tooltip")
  tip.append(...body.childNodes)
  tip.addEventListener("mouseenter", () => window.clearTimeout(hideTimer))
  tip.addEventListener("mouseleave", hideSoon)
  document.body.append(tip)
  place(tip, ref)
}

document.addEventListener("nav", () => {
  const refs = document.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]")
  for (const ref of refs) {
    const onEnter = () => show(ref)
    ref.addEventListener("mouseenter", onEnter)
    ref.addEventListener("focus", onEnter)
    ref.addEventListener("mouseleave", hideSoon)
    ref.addEventListener("blur", hideSoon)
    window.addCleanup(() => {
      ref.removeEventListener("mouseenter", onEnter)
      ref.removeEventListener("focus", onEnter)
      ref.removeEventListener("mouseleave", hideSoon)
      ref.removeEventListener("blur", hideSoon)
    })
  }
  window.addEventListener("scroll", hide, { passive: true })
  window.addCleanup(() => {
    window.removeEventListener("scroll", hide)
    hide()
  })
})
