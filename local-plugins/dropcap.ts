import type { Paragraph, Root, RootContent } from "mdast"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"

export const DROP_CAP = "dropcap"

// Only the texts a reader settles into; a stream note is a few lines and has no opening to mark.
const SPECIES = new Set(["post", "evergreen"])
// A drop cap over two or three lines needs a paragraph that runs at least that long.
const MIN_LENGTH = 200
// A letter: a quotation mark dropped with it is a three-line « that outweighs the letter.
const OPENING = /^\p{L}/u
// The text proper starts after an epigraph (a leading quotation) and after a short preface closed
// by a rule (a translator's note beside the cover).
const PREFACE_BLOCKS = 2

function textOf(node: { value?: string; children?: unknown[] }): string {
  if (typeof node.value === "string") return node.value
  return (node.children ?? []).map((child) => textOf(child as typeof node)).join("")
}

function opensText(node: RootContent | undefined): node is Paragraph {
  if (node?.type !== "paragraph") return false
  if (node.children[0]?.type !== "text") return false
  const text = textOf(node)
  return OPENING.test(text) && text.length >= MIN_LENGTH
}

export function dropCapTarget(tree: Root): Paragraph | undefined {
  const blocks = tree.children.filter((node) => node.type !== "yaml" && node.type !== "definition")
  const epigraphs = blocks.findIndex((node) => node.type !== "blockquote")
  const text = epigraphs === -1 ? [] : blocks.slice(epigraphs)
  const rule = text.findIndex((node) => node.type === "thematicBreak")
  const preface =
    rule > 0 &&
    rule <= PREFACE_BLOCKS &&
    text.slice(0, rule).every((node) => node.type === "paragraph")
  const first = text[preface ? rule + 1 : 0]
  return opensText(first) ? first : undefined
}

export function markDropCap(tree: Root): void {
  const target = dropCapTarget(tree)
  if (!target) return
  const data = (target.data ??= {}) as { hProperties?: Record<string, unknown> }
  data.hProperties = { ...data.hProperties, className: [DROP_CAP] }
}

export const DropCap: QuartzTransformerPlugin = () => ({
  name: "DropCap",
  markdownPlugins() {
    return [
      () => (tree: Root, file) => {
        if (!SPECIES.has(file.data.frontmatter?.type as string)) return
        markDropCap(tree)
      },
    ]
  },
})
