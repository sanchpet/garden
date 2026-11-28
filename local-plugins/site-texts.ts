import fs from "fs"
import path from "path"
import type { Nodes, Root } from "mdast"
import remarkParse from "remark-parse"
import { unified } from "unified"
import type { Language } from "./languages"

// What the site itself says around the texts lives in one Markdown file per language,
// `<lang>/site.md`, one `## key` section per text, so the owner edits it like any text and a new
// text is a new heading. quartz.config.yaml keeps the file out of the pages; the engine reads it
// here. A missing file or section, or an empty one, is `undefined`, and the caller decides.
export type SiteText = "feed" | "language"

export function siteText(contentDir: string, lang: Language, name: SiteText): string | undefined {
  let raw: string
  try {
    raw = fs.readFileSync(path.join(contentDir, lang, "site.md"), "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
  return siteSections(raw).get(name)
}

// Splits the file at `## ` headings outside fenced code; text before the first one is ignored.
export function siteSections(raw: string): Map<string, string> {
  const body = raw.startsWith("---\n") ? raw.slice(raw.indexOf("\n---", 4) + 4) : raw
  const sections = new Map<string, string>()
  let key: string | undefined
  let lines: string[] = []
  let fence: string | undefined
  const close = () => {
    const text = lines.join("\n").trim()
    if (key !== undefined && text && !sections.has(key)) sections.set(key, text)
  }
  for (const line of body.split("\n")) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    if (
      marker &&
      (fence === undefined || (marker[0] === fence[0] && marker.length >= fence.length))
    )
      fence = fence === undefined ? marker : undefined
    const heading = fence === undefined && !marker ? /^##[ \t]+(.+?)[ \t#]*$/.exec(line) : null
    if (heading) {
      close()
      key = heading[1].trim().toLowerCase()
      lines = []
    } else lines.push(line)
  }
  close()
  return sections
}

// The language note sits in a tooltip, so it is plain text: Markdown keeps only its words.
export function plainText(markdown: string): string {
  const tree = unified().use(remarkParse).parse(markdown) as Root
  const blocks: string[] = []
  const text = (node: Nodes): string =>
    "value" in node && node.type !== "html"
      ? node.value
      : "children" in node
        ? node.children.map(text).join("")
        : ""
  for (const block of tree.children) blocks.push(text(block).trim())
  return blocks.filter(Boolean).join(" ")
}
