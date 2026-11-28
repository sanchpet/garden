import {
  bell,
  currentSection,
  dockLengths,
  dockOpacity,
  DOCK,
  nearestIndex,
  readingLine,
} from "./dash-toc-logic"

// Marks the dash of the section being read, and swells the dashes around the pointer or the
// focused dash like a dock.
document.addEventListener("nav", () => {
  const nav = document.querySelector<HTMLElement>("nav.dash-toc")
  if (!nav) return
  const links = [...nav.querySelectorAll<HTMLAnchorElement>("a[data-slug]")]
  const dashes = links.map((a) => a.querySelector<SVGSVGElement>("svg.dash"))
  const rests = dashes.map((svg) => Number(svg?.getAttribute("width") ?? 20))
  const headings = links.map((a) => document.getElementById(a.dataset.slug ?? ""))
  let frame = 0
  let shown = -2

  const update = () => {
    frame = 0
    const root = document.documentElement
    const line = readingLine(
      window.innerHeight,
      window.scrollY,
      root.scrollHeight - root.clientHeight,
    )
    const tops = headings.map((h) => (h ? h.getBoundingClientRect().top : Infinity))
    const current = currentSection(tops, line)
    if (current === shown) return
    shown = current
    links.forEach((a, i) => {
      if (i === current) a.setAttribute("aria-current", "location")
      else a.removeAttribute("aria-current")
    })
  }
  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(update)
  }

  // The dock. The pointer's height over the strip, or the focused dash, sets a target length
  // for every dash; each frame moves the drawn lengths a part of the way there.
  const still = window.matchMedia("(prefers-reduced-motion: reduce)")
  // Centres relative to the strip; the strip is sticky, so they hold while it is in use.
  let centres: number[] = []
  const measure = () => {
    const top = nav.getBoundingClientRect().top
    centres = links.map((a) => {
      const box = a.getBoundingClientRect()
      return box.top - top + box.height / 2
    })
  }
  const drawn = [...rests]
  let pointerY: number | null = null
  let focused = -1
  let dockFrame = 0

  const targets = (): { lengths: number[]; near: number } => {
    const y = focused >= 0 ? centres[focused] : pointerY
    if (y === null) return { lengths: rests, near: -1 }
    return { lengths: dockLengths(rests, centres, y), near: nearestIndex(centres, y) }
  }

  const step = () => {
    dockFrame = 0
    const { lengths, near } = targets()
    let moving = false
    dashes.forEach((svg, i) => {
      if (!svg) return
      const gap = lengths[i] - drawn[i]
      drawn[i] = still.matches || Math.abs(gap) < 0.3 ? lengths[i] : drawn[i] + gap * 0.3
      if (drawn[i] !== lengths[i]) moving = true
      svg.style.width = `${drawn[i]}px`
      links[i].style.setProperty("--len", `${drawn[i]}px`)
      if (near >= 0) {
        svg.style.opacity = String(dockOpacity(bell(centres[i] - centres[near]), i === near))
      }
      links[i].classList.toggle("near", i === near)
    })
    nav.classList.toggle("docked", near >= 0)
    if (near < 0 && !moving) {
      // Back at rest: the stylesheet draws the strip again.
      dashes.forEach((svg, i) => {
        svg?.style.removeProperty("width")
        svg?.style.removeProperty("opacity")
        links[i].style.removeProperty("--len")
      })
      return
    }
    if (moving) dockFrame = requestAnimationFrame(step)
  }
  const dock = () => {
    if (dockFrame === 0) dockFrame = requestAnimationFrame(step)
  }

  const reach = DOCK.amp + Math.max(...rests)
  const onMove = (event: PointerEvent) => {
    const box = nav.getBoundingClientRect()
    const inside =
      event.clientY >= box.top - 12 &&
      event.clientY <= box.bottom + 12 &&
      event.clientX >= box.right - reach - 16 &&
      event.clientX <= box.right + 16
    if (!inside) {
      pointerY = null
      window.removeEventListener("pointermove", onMove)
    } else {
      pointerY = event.clientY - box.top
    }
    dock()
  }
  const onEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return
    measure()
    window.addEventListener("pointermove", onMove, { passive: true })
    onMove(event)
  }
  const onFocusIn = (event: FocusEvent) => {
    measure()
    const i = links.indexOf(event.target as HTMLAnchorElement)
    focused = i >= 0 && links[i].matches(":focus-visible") ? i : -1
    dock()
  }
  const onFocusOut = (event: FocusEvent) => {
    if (!links.includes(event.relatedTarget as HTMLAnchorElement)) {
      focused = -1
      dock()
    }
  }

  update()
  window.addEventListener("scroll", schedule, { passive: true })
  window.addEventListener("resize", schedule)
  nav.addEventListener("pointerenter", onEnter)
  nav.addEventListener("focusin", onFocusIn)
  nav.addEventListener("focusout", onFocusOut)
  window.addCleanup(() => {
    cancelAnimationFrame(frame)
    cancelAnimationFrame(dockFrame)
    window.removeEventListener("scroll", schedule)
    window.removeEventListener("resize", schedule)
    window.removeEventListener("pointermove", onMove)
    nav.removeEventListener("pointerenter", onEnter)
    nav.removeEventListener("focusin", onFocusIn)
    nav.removeEventListener("focusout", onFocusOut)
  })
})
