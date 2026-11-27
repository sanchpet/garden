const STORAGE_KEY = "garden-lang"
const LANGUAGES = ["ru", "en"]

export function rememberLanguage(lang: string) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {}
}

// The reader's own choice from the switch, else the browser's languages, else English.
export function preferredLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGES.includes(saved)) return saved
  } catch {}
  const browser = navigator.languages.map((l) => l.split("-")[0])
  return browser.find((l) => LANGUAGES.includes(l)) ?? "en"
}
