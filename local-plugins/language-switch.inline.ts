const STORAGE_KEY = "garden-lang"
const LANGUAGES = ["ru", "en"]
// Search builds its index once per page load, from the language the reader arrived in.
const indexedLanguages = new Set<string>([document.documentElement.lang])

function rememberLanguage(lang: string) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {}
}

function preferredLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGES.includes(saved)) return saved
  } catch {}
  const browser = navigator.languages.map((l) => l.split("-")[0])
  return browser.find((l) => LANGUAGES.includes(l)) ?? "en"
}

// Feed search each further language the reader reaches, by the switch or by a link.
async function indexForSearch(lang: string) {
  if (indexedLanguages.has(lang)) return
  indexedLanguages.add(lang)
  const data = await (window as any).fetchData
  document.dispatchEvent(
    new CustomEvent("content-index-updated", { detail: { slugs: Object.keys(data) } }),
  )
}

async function switchTo(link: HTMLAnchorElement) {
  const max = document.documentElement.scrollHeight - window.innerHeight
  const ratio = max > 0 ? window.scrollY / max : 0
  rememberLanguage(link.dataset.lang!)
  await window.spaNavigate(new URL(link.href), false, { replace: true, keepScroll: true })
  const newMax = document.documentElement.scrollHeight - window.innerHeight
  // "instant": the site scrolls smoothly, and an animated jump would read as navigation.
  window.scrollTo({ top: ratio * newMax, behavior: "instant" })
}

document.addEventListener("nav", () => {
  // The site root only picks a language.
  if (document.body.dataset.slug === "index") {
    const home = new URL(
      `${document.body.dataset.basepath ?? ""}/${preferredLanguage()}/`,
      location.origin,
    )
    window.spaNavigate(home, false, { replace: true })
    return
  }

  void indexForSearch(document.documentElement.lang)
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".language-switch a")) {
    if (link.classList.contains("twin")) window.spaPrefetch(new URL(link.href))
    const onClick = (event: MouseEvent) => {
      rememberLanguage(link.dataset.lang!)
      if (!link.classList.contains("twin") || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      switchTo(link)
    }
    link.addEventListener("click", onClick)
    window.addCleanup(() => link.removeEventListener("click", onClick))
  }
})
