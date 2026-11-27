// Counts every page the reader opens, SPA navigations included, and fills the views line under
// an article. count.js reads its settings from window.goatcounter when it loads, so the setup
// import has to come first.
import "./goatcounter-setup.inline"
// @ts-ignore
import "./goatcounter/count.js"
import { counterUrl, viewsLine } from "./analytics"
import { languageOf } from "./languages"

type GoatCounter = { count(vars: { path: string; referrer?: string }): void }
const counter = () => (window as unknown as { goatcounter?: GoatCounter }).goatcounter

// The first page keeps the browser's referrer (Telegram, a search engine); a page opened from
// inside the site names the page it was opened from.
let previous: string | undefined

async function fillViews(path: string) {
  const line = document.querySelector<HTMLElement>("[data-views]")
  if (!line) return
  const lang = languageOf(path.slice(1))
  if (!lang) return
  try {
    const res = await fetch(counterUrl(path))
    if (!res.ok) return
    const text = viewsLine((await res.json()).count, lang)
    if (!text || location.pathname !== path) return
    line.textContent = text
    line.hidden = false
  } catch {
    // Blocked or offline: the article simply has no views line.
  }
}

document.addEventListener("nav", () => {
  const path = location.pathname
  if (location.hostname === "sanch.pet") {
    counter()?.count({ path, ...(previous ? { referrer: previous } : {}) })
  }
  previous = location.href
  void fillViews(path)
})
