(() => {
  const XML = "http://www.w3.org/XML/1998/namespace"
  const lang = document.documentElement.getAttributeNS(XML, "lang") || "en"
  const said = {"ru":"скопировано","en":"copied"}[lang] || "copied"
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
