import path from "node:path"
import sharp from "sharp"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"
import { FilePath, FullSlug, joinSegments, pathToRoot, slugifyFilePath } from "../quartz/util/path"

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

// The original file, for link previews (og:image) and the generated cards, which want it big.
export function coverOf(data: unknown): string | undefined {
  return (data as { cover?: string }).cover
}

// A page shows a cover at most 300 px wide, so it gets a WebP copy this wide, enough for 2x
// screens; the copy is never wider than the original. thumbs.tsx writes it.
export const COVER_WIDTH = 640

export interface CoverCopy {
  path: string
  width: number
  height: number
}

export const coverCopyPath = (coverSlug: string) =>
  `static/covers/${coverSlug.replace(/\.[a-z0-9]+$/i, "")}.webp`

// The copy's size from the original's: turned upright as the copy will be (EXIF orientation
// 5–8 swaps the sides), then narrowed to COVER_WIDTH at most.
export function copySize(meta: { width?: number; height?: number; orientation?: number }) {
  if (!meta.width || !meta.height) return undefined
  const [w, h] =
    (meta.orientation ?? 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height]
  const width = Math.min(w, COVER_WIDTH)
  return { width, height: Math.round((h * width) / w) }
}

export function coverCopyOf(data: unknown): CoverCopy | undefined {
  return (data as { coverCopy?: CoverCopy }).coverCopy
}

// What the page's <img> loads: the copy when there is one, the original otherwise.
export function coverImage(
  data: unknown,
): { src: string; width?: number; height?: number } | undefined {
  const cover = coverOf(data)
  if (!cover) return undefined
  const copy = coverCopyOf(data)
  return copy ? { src: copy.path, width: copy.width, height: copy.height } : { src: cover }
}

export const CoverImage: QuartzTransformerPlugin = () => ({
  name: "CoverImage",
  markdownPlugins(ctx) {
    return [
      () => async (_tree, file) => {
        const name = coverName(
          (file.data.frontmatter as Record<string, unknown> | undefined)?.cover,
        )
        if (!name) return
        const found = ctx.allFiles.find(
          (fp) => !fp.endsWith(".md") && path.posix.basename(fp) === name,
        )
        if (found) {
          const data = file.data as { cover?: string; coverCopy?: CoverCopy }
          data.cover = found
          const size = copySize(await sharp(path.join(ctx.argv.directory, found)).metadata())
          if (size)
            data.coverCopy = { path: coverCopyPath(slugifyFilePath(found as FilePath)), ...size }
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
    const cover = coverImage(fileData)
    if (!cover) return null
    const src = joinSegments(pathToRoot(fileData.slug as FullSlug), encodeURI(cover.src))
    return (
      <div class="note-cover">
        <img
          src={src}
          width={cover.width}
          height={cover.height}
          style={
            cover.width && cover.height ? `--cover-ratio: ${cover.width / cover.height}` : undefined
          }
          alt=""
        />
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
  height: auto;
  max-width: 300px;
  max-height: 340px;
  margin: 0;
  border-radius: 4px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}
/* The box the image will fill, known before it loads: the title and the text beside it wrap
   once instead of reflowing when the image arrives. */
.note-cover img[style] {
  width: min(300px, 340px * var(--cover-ratio));
}
.center > hr {
  clear: both;
}
/* In a link popover the full cover fills the whole window and the page's title and text are
   out of sight below it. */
.popover .note-cover {
  margin: 1rem 0 0.5rem 1rem;
}
.popover .note-cover img {
  max-width: 110px;
  max-height: 140px;
  box-shadow: none;
}
.popover .note-cover img[style] {
  width: min(110px, 140px * var(--cover-ratio));
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
  .note-cover img[style] {
    width: min(100%, 220px * var(--cover-ratio));
  }
}
`
  return Cover
}) satisfies QuartzComponentConstructor
