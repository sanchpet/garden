import type { Blockquote, Nodes, Paragraph, PhrasingContent, Root } from "mdast"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { escapeXml } from "./feed-atom"
import type { Language } from "./languages"

// What the feed says above its list when a browser opens it, unless the `## feed` section of
// `<lang>/site.md` says it.
export const DEFAULT_FEED_NOTE: Record<Language, string> = {
  ru: "Это лента для RSS-читалки. Скопируйте адрес страницы в читалку, чтобы подписаться.",
  en: "This is a feed for an RSS reader. Copy the page's address into your reader to subscribe.",
}

// The note as XHTML: the site text when it says something, the default otherwise.
export function feedNote(markdown: string | undefined, lang: Language): string {
  const own = markdown ? noteXhtml(markdown) : ""
  return own || noteXhtml(DEFAULT_FEED_NOTE[lang])
}

// Only these reach the feed: paragraphs, Obsidian callouts, links, emphasis, inline code and line
// breaks. Raw HTML is dropped, any other block keeps its text, and a link keeps its href only on
// a safe scheme.
const SAFE_HREF = /^(https?:|mailto:|\/(?!\/))/i

export function noteXhtml(markdown: string): string {
  // A script or style element goes whole: Markdown would keep the text between its tags.
  const bare = markdown.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
  return blocks(unified().use(remarkParse).parse(bare) as Root)
}

function blocks(tree: Root): string {
  const paragraphs: string[] = []
  const collect = (node: Nodes) => {
    const callout = node.type === "blockquote" ? calloutOf(node) : undefined
    if (callout) {
      paragraphs.push(callout)
    } else if (node.type === "paragraph" || node.type === "heading") {
      const inner = node.children.map(phrasing).join("").trim()
      if (inner) paragraphs.push(`<h:p>${inner}</h:p>`)
    } else if (node.type === "code") {
      paragraphs.push(`<h:p><h:code>${escapeXml(node.value)}</h:code></h:p>`)
    } else if ("children" in node) {
      node.children.forEach(collect)
    }
  }
  collect(tree)
  return paragraphs.join("")
}

// `> [!type] Title` and the lines under it, as Obsidian writes a callout.
const CALLOUT = /^\[!([\w-]+)\][+-]?[ \t]*([^\n]*)\n?/

function calloutOf(quote: Blockquote): string | undefined {
  const [first, ...rest] = quote.children
  const lead = first?.type === "paragraph" ? first.children[0] : undefined
  const match = lead?.type === "text" ? CALLOUT.exec(lead.value) : null
  if (!first || first.type !== "paragraph" || !lead || lead.type !== "text" || !match) return
  const [marker, kind, title] = match
  const remainder = lead.value.slice(marker.length)
  const opening: Paragraph = {
    ...first,
    children: [...(remainder ? [{ ...lead, value: remainder }] : []), ...first.children.slice(1)],
  }
  const body = blocks({ type: "root", children: [opening, ...rest] })
  const heading = title.trim() || kind
  return `<h:div class="callout"><h:p class="callout-title">${escapeXml(heading)}</h:p>${body}</h:div>`
}

function phrasing(node: PhrasingContent): string {
  const inner = () => ("children" in node ? node.children.map(phrasing).join("") : "")
  switch (node.type) {
    case "text":
      return escapeXml(node.value)
    case "inlineCode":
      return `<h:code>${escapeXml(node.value)}</h:code>`
    case "strong":
      return `<h:strong>${inner()}</h:strong>`
    case "emphasis":
      return `<h:em>${inner()}</h:em>`
    case "break":
      return "<h:br/>"
    case "link":
      return SAFE_HREF.test(node.url)
        ? `<h:a href="${escapeXml(node.url)}">${inner()}</h:a>`
        : inner()
    case "html":
      return ""
    default:
      return inner()
  }
}
