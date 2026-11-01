import path from "node:path"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"
import { FullSlug, joinSegments, pathToRoot } from "../quartz/util/path"

export const COVER_MISSING_MARK = "garden: cover not found"

// `cover: "[[name.jpg]]"` in a note's frontmatter, as Obsidian writes a link property. The file
// is found by name anywhere in the texts; garden-publish.sh moves it into media/ before a push.
export function coverName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const name = value
    .replace(/^\[\[|\]\]$/g, "")
    .split("|")[0]
    .trim()
  return name ? path.posix.basename(name) : undefined
}

export function coverOf(data: unknown): string | undefined {
  return (data as { cover?: string }).cover
}

export const CoverImage: QuartzTransformerPlugin = () => ({
  name: "CoverImage",
  markdownPlugins(ctx) {
    return [
      () => (_tree, file) => {
        const name = coverName(
          (file.data.frontmatter as Record<string, unknown> | undefined)?.cover,
        )
        if (!name) return
        const found = ctx.allFiles.find(
          (fp) => !fp.endsWith(".md") && path.posix.basename(fp) === name,
        )
        if (found) {
          ;(file.data as { cover?: string }).cover = found
        } else {
          console.warn(`${COVER_MISSING_MARK}: ${file.data.slug} → ${name}`)
        }
      },
    ]
  },
})

// Most covers are portrait posters with text in them, so the image is never cropped: it floats
// right of the title and the opening of the text wraps around it, so reading starts on the
// first screen. The component comes first in beforeBody to float from the top.
export const NoteCover = (() => {
  const Cover: QuartzComponent = ({ fileData }) => {
    const cover = coverOf(fileData)
    if (!cover) return null
    const src = joinSegments(pathToRoot(fileData.slug as FullSlug), encodeURI(cover))
    return (
      <div class="note-cover">
        <img src={src} alt="" />
      </div>
    )
  }

  Cover.css = `
.note-cover {
  float: right;
  margin: 0 0 1rem 2rem;
}
.note-cover img {
  display: block;
  width: auto;
  max-width: 300px;
  max-height: 340px;
  margin: 0;
  border-radius: 4px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}
.center > hr {
  clear: both;
}
@media (max-width: 800px) {
  .page-header .popover-hint:has(> .note-cover) {
    display: flex;
    flex-direction: column;
  }
  .note-cover {
    order: 1;
    float: none;
    margin: 0 0 1.5rem;
  }
  .note-cover img {
    max-width: 100%;
    max-height: 220px;
  }
}
`
  return Cover
}) satisfies QuartzComponentConstructor
