import { currentSection, readingLine } from "./dash-toc-logic"

// Marks the dash of the section being read.
document.addEventListener("nav", () => {
  const nav = document.querySelector<HTMLElement>("nav.dash-toc")
  if (!nav) return
  const links = [...nav.querySelectorAll<HTMLAnchorElement>("a[data-slug]")]
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

  update()
  window.addEventListener("scroll", schedule, { passive: true })
  window.addEventListener("resize", schedule)
  window.addCleanup(() => {
    cancelAnimationFrame(frame)
    window.removeEventListener("scroll", schedule)
    window.removeEventListener("resize", schedule)
  })
})
