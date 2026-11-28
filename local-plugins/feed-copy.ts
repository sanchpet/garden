// A browser that opens the feed copies a code span of the note (the subscribe command) on a
// click and says so in the hand. Without the script the stylesheet still selects the span whole.
export const FEED_SCRIPT = "/static/feed.js"

export const COPIED: Record<string, string> = { ru: "скопировано", en: "copied" }

export function feedScript(): string {
  return `(() => {
  const XML = "http://www.w3.org/XML/1998/namespace"
  const lang = document.documentElement.getAttributeNS(XML, "lang") || "en"
  const said = ${JSON.stringify(COPIED)}[lang] || ${JSON.stringify(COPIED.en)}
  document.addEventListener("click", async (event) => {
    const code = event.target instanceof Element ? event.target.closest("div.subscribe code") : null
    if (!code || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(code.textContent.trim())
    } catch {
      return
    }
    const mark = document.createElementNS("http://www.w3.org/1999/xhtml", "span")
    mark.setAttribute("class", "copied")
    mark.textContent = said
    code.after(mark)
    setTimeout(() => mark.remove(), 1600)
  })
})()
`
}
