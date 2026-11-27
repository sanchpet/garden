import type { Paragraph, PhrasingContent, Root, RootContent } from "mdast"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"
import { kindOf } from "./kinds"

// The texts are written in Obsidian, where one Enter already starts a new line of text. On the
// site such lines would run into one paragraph, so a line of running text is a paragraph here.
// Only top-level paragraphs: quotations, callouts, lists, tables, footnotes and code keep their
// own line rules. Runs after the core parsed wikilinks, embeds, code and math into their own
// nodes, so a split only ever cuts plain text.
export function splitParagraph(paragraph: Paragraph): Paragraph[] {
  const lines: PhrasingContent[][] = [[]]
  for (const child of paragraph.children) {
    if (child.type !== "text" || !child.value.includes("\n")) {
      lines[lines.length - 1].push(child)
      continue
    }
    child.value.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([])
      lines[lines.length - 1].push({ type: "text", value: part })
    })
  }
  if (lines.length === 1) return [paragraph]
  return lines
    .map(trimmed)
    .filter((line) => line.length > 0)
    .map((children) => ({ type: "paragraph", children }))
}

function trimmed(line: PhrasingContent[]): PhrasingContent[] {
  const out = [...line]
  const first = out[0]
  if (first?.type === "text") out[0] = { ...first, value: first.value.trimStart() }
  const last = out[out.length - 1]
  if (last?.type === "text") out[out.length - 1] = { ...last, value: last.value.trimEnd() }
  return out.filter((node) => node.type !== "text" || node.value !== "")
}

export function splitLines(tree: Root): void {
  if (!tree.children.some((node) => node.type === "paragraph")) return
  tree.children = tree.children.flatMap((node): RootContent[] =>
    node.type === "paragraph" ? splitParagraph(node) : [node],
  )
}

// The red line is a page's choice: `indent: true` adds a class the stock page puts on its article,
// the same `cssclasses` Obsidian reads.
export const RED_LINE = "red-line"

export function withRedLine(frontmatter: Record<string, unknown> | undefined): void {
  if (frontmatter?.indent !== true) return
  const own = frontmatter.cssclasses
  const classes = Array.isArray(own) ? own : typeof own === "string" ? [own] : []
  if (!classes.includes(RED_LINE)) frontmatter.cssclasses = [...classes, RED_LINE]
}

export const ParagraphPerLine: QuartzTransformerPlugin = () => ({
  name: "ParagraphPerLine",
  markdownPlugins() {
    return [
      () => (tree: Root, file) => {
        withRedLine(file.data.frontmatter)
        // Indexes and module pages (the stream, the race calendar) are laid out, not written.
        const slug = file.data.slug ?? ""
        if (slug === "index" || slug.endsWith("/index")) return
        if (kindOf(file.data.frontmatter?.type) === "module") return
        splitLines(tree)
      },
    ]
  },
})
