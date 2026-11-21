import fs from "node:fs"
import path from "node:path"
import type { Element, Root } from "hast"
import type { Root as MdRoot } from "mdast"
import { SKIP, visit } from "unist-util-visit"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"
import type { BuildCtx } from "../quartz/util/ctx"
import { FilePath, slugifyFilePath } from "../quartz/util/path"
import { frontmatterOf, isDraft } from "./frontmatter"
import { languageOf } from "./languages"
import { dayOf, formatDay } from "./stream-events"

// Keyed by the file list, which a rebuild under --serve replaces on the same context.
const pages = new WeakMap<object, Map<string, Record<string, unknown>>>()
const published = new WeakMap<object, Set<string>>()

// The notes that will exist on the site, with their frontmatter as written. Read from disk:
// a page being parsed cannot see the others, and drafts are filtered out only after that.
// A note whose frontmatter cannot be read here counts as unpublished: it may be a draft, and
// a link stripped in error is the safe mistake.
export function publishedPages(ctx: BuildCtx): Map<string, Record<string, unknown>> {
  let notes = pages.get(ctx.allFiles)
  if (!notes) {
    notes = new Map()
    for (const fp of ctx.allFiles) {
      if (!fp.endsWith(".md")) continue
      const text = fs.readFileSync(path.join(ctx.argv.directory, fp), "utf8")
      const frontmatter = frontmatterOf(text)
      if (frontmatter && !isDraft(frontmatter))
        notes.set(slugifyFilePath(fp as FilePath), frontmatter)
    }
    pages.set(ctx.allFiles, notes)
  }
  return notes
}

// Pages and files that will exist on the site. ctx.allSlugs is not that: it also holds every
// frontmatter alias as a slug, and drafts.
export function publishedSlugs(ctx: BuildCtx): Set<string> {
  let slugs = published.get(ctx.allFiles)
  if (!slugs) {
    const files = ctx.allFiles.filter((fp) => !fp.endsWith(".md"))
    slugs = new Set([
      ...files.map((fp) => slugifyFilePath(fp as FilePath)),
      ...publishedPages(ctx).keys(),
    ])
    published.set(ctx.allFiles, slugs)
  }
  return slugs
}

// The texts keep Obsidian's frontmatter: the human title lives in `aliases`,
// the evergreen revision date in `revised`. The site adapts to them, not the reverse.
export const GardenFrontmatter: QuartzTransformerPlugin = () => ({
  name: "GardenFrontmatter",
  markdownPlugins() {
    return [
      () => (_tree, file) => {
        const fm = file.data.frontmatter as Record<string, unknown> | undefined
        if (!fm) return
        // A note has no title of its own: its page is headed by its day.
        if (fm.type === "note" && fm.title === file.stem) {
          const day = dayOf(fm.published ?? fm.created)
          if (day) fm.title = formatDay(day, languageOf(file.data.slug) ?? "ru", "long")
        }
        const aliases = fm.aliases
        if (fm.title === file.stem && Array.isArray(aliases) && aliases.length > 0) {
          fm.title = String(aliases[0])
        }
        if (typeof fm.revised === "string" && file.data.dates) {
          const revised = new Date(fm.revised)
          if (!isNaN(revised.getTime())) file.data.dates.modified = revised
        }
      },
    ]
  },
})

export const PRIVATE_LINK_MARK = "garden: private link stripped"

// A link into the private vault is visible in garden-texts by design, but on the
// site it would lead to a 404. Keep its text, drop the anchor, and say so in the build log.
export const StripPrivateLinks: QuartzTransformerPlugin = () => ({
  name: "StripPrivateLinks",
  htmlPlugins(ctx) {
    const published = publishedSlugs(ctx)
    return [
      () => (tree: Root, file) => {
        visit(tree, "element", (node: Element, index, parent) => {
          if (node.tagName !== "a" || !parent || index === undefined) return
          const classes = node.properties?.className
          if (!Array.isArray(classes) || !classes.includes("internal")) return
          const slug = node.properties?.["data-slug"]
          if (typeof slug !== "string" || published.has(slug) || slug.startsWith("tags/")) return
          console.warn(`${PRIVATE_LINK_MARK}: ${file.data.slug} → ${slug}`)
          file.data.links = file.data.links?.filter((link) => link !== slug)
          parent.children.splice(index, 1, ...node.children)
          return [SKIP, index]
        })
      },
    ]
  },
})

// Blocks that only work inside Obsidian: a Meta Bind button, a Dataview query. On the site
// they would show as their source, so they go, and so does a heading they leave empty.
const OBSIDIAN_ONLY = new Set(["meta-bind-button", "meta-bind", "dataview", "dataviewjs"])

export const ObsidianOnlyBlocks: QuartzTransformerPlugin = () => ({
  name: "ObsidianOnlyBlocks",
  markdownPlugins() {
    return [
      () => (tree: MdRoot) => {
        const kept = tree.children.filter(
          (node) => !(node.type === "code" && OBSIDIAN_ONLY.has(node.lang ?? "")),
        )
        if (kept.length === tree.children.length) return
        // From the end, so a heading whose only subsection went empty goes too.
        for (let i = kept.length - 1; i >= 0; i--) {
          const node = kept[i]
          if (node.type !== "heading") continue
          const next = kept[i + 1]
          if (!next || (next.type === "heading" && next.depth <= node.depth)) kept.splice(i, 1)
        }
        tree.children = kept
      },
    ]
  },
})
