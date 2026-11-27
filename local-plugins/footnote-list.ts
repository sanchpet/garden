import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"
import type { Language } from "./languages"

const HEADING: Record<Language, string> = { ru: "Примечания", en: "Notes" }
const BACK: Record<Language, (n: string) => string> = {
  ru: (n) => `Вернуться к сноске ${n}`,
  en: (n) => `Back to reference ${n}`,
}

// remark-gfm labels the list in English, with a heading for screen readers only; under a text the
// list has to be told from the Sources list, so the heading is shown, in the page's language.
export function labelFootnotes(tree: Root, lang: Language | undefined) {
  visit(tree, "element", (node: Element) => {
    const back = node.properties.ariaLabel
    if ("dataFootnoteBackref" in node.properties && typeof back === "string") {
      node.properties.ariaLabel = BACK[lang ?? "en"](back.replace(/^\D*/, ""))
    }
    if (node.tagName !== "section" || !("dataFootnotes" in node.properties)) return
    const heading = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "h2",
    )
    if (!heading) return
    const classes = heading.properties.className
    const kept = Array.isArray(classes) ? classes.filter((name) => name !== "sr-only") : []
    heading.properties.className = kept.length ? kept : undefined
    heading.children = [{ type: "text", value: HEADING[lang ?? "en"] }]
  })
}
