import fs from "node:fs"
import path from "node:path"
import type { Html, Root } from "mdast"
import { visit } from "unist-util-visit"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"

// The texts repo marks a drawing it wants inlined; any other SVG stays an <object>.
const MARK = "data-garden-drawing"
// A drawing narrower than a phone column needs only shrinks to half its size, where its hand
// lettering is still legible, and scrolls sideways below that. A wide one, like the study plan,
// keeps 720px: shrunk to half it would be too small to read.
const WIDE = 720
export function floor(svg: string): string {
  const width = Number(/<svg\b[^>]*\bwidth="(\d+(?:\.\d+)?)"/.exec(svg)?.[1])
  if (!width || width >= WIDE) return ""
  return ` style="--drawing-min: ${Math.round(width / 2)}px"`
}

const EMBED = /^<object data="([^"]+\.svg)" type="image\/svg\+xml"[^>]*><\/object>$/

// An embedded drawing goes into the page as markup, not as a picture: inside an <img> or
// an <object> its links lead nowhere and its text is not the page's text. This runs on the
// Markdown tree so the inlined links are parsed before the core resolves links, and then
// take the same path as links in prose: language, drafts, private notes.
export const InlineDrawings: QuartzTransformerPlugin = () => ({
  name: "InlineDrawings",
  markdownPlugins(ctx) {
    const drawings = new Map<string, string[]>()
    for (const fp of ctx.allFiles) {
      if (!fp.endsWith(".svg")) continue
      const name = path.basename(fp)
      drawings.set(name, [...(drawings.get(name) ?? []), fp])
    }
    return [
      () => (tree: Root, file) => {
        visit(tree, "html", (node: Html) => {
          const embed = EMBED.exec(node.value.trim())
          if (!embed) return
          const found = drawings.get(path.basename(embed[1])) ?? []
          if (found.length !== 1) {
            console.warn(`garden: drawing ${embed[1]} on ${file.data.slug}: ${found.length} files`)
            return
          }
          const svg = fs.readFileSync(path.join(ctx.argv.directory, found[0]), "utf8")
          if (!svg.includes(MARK)) return
          node.value = `<figure class="garden-drawing"${floor(svg)}>${svg.trim()}</figure>`
        })
      },
    ]
  },
})
