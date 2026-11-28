import fs from "fs"
import path from "path"
import type { Nodes, Root } from "mdast"
import remarkParse from "remark-parse"
import { unified } from "unified"
import type { Language } from "./languages"

// What the site itself says around the texts lives as Markdown files in `<lang>/site/`, so the
// owner edits it like any text. quartz.config.yaml keeps the folder out of the pages; the engine
// reads the files here. A missing or empty file is `undefined`, and the caller decides the default.
export type SiteText = "feed" | "language"

export function siteText(contentDir: string, lang: Language, name: SiteText): string | undefined {
  let raw: string
  try {
    raw = fs.readFileSync(path.join(contentDir, lang, "site", `${name}.md`), "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
  const body = raw.startsWith("---\n") ? raw.slice(raw.indexOf("\n---", 4) + 4) : raw
  return body.trim() || undefined
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
