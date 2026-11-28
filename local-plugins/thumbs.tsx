import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import type { Element, Root } from "hast"
import type { QuartzEmitterPlugin } from "../quartz/plugins/types"
import { FilePath, joinSegments, slugifyFilePath } from "../quartz/util/path"
import { COVER_WIDTH, coverCopyOf, coverOf } from "./cover"

// The stream shows a note's pictures small, and a phone photo at full size would make it the
// heaviest page of the site. Each picture of a note gets a copy this wide, for 2x screens.
const WIDTH = 640

// The picture's own slug, from its `src` as rendered on the page of `slug`; null for a picture
// that is not one of the texts' files.
export function pictureSlug(src: string, slug: string): string | null {
  if (/^[a-z]+:|^\/|^#/i.test(src)) return null
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(slug), decodeURI(src)))
  return joined.startsWith("..") ? null : joined
}

export const thumbPath = (picture: string) =>
  `static/thumbs/${picture.replace(/\.[a-z0-9]+$/i, "")}.jpg`

export function pictures(tree: Root | Element): string[] {
  const found: string[] = []
  const walk = (node: Root | Element) => {
    if (
      node.type === "element" &&
      node.tagName === "img" &&
      typeof node.properties?.src === "string"
    )
      found.push(node.properties.src)
    for (const child of node.children ?? []) if (child.type === "element") walk(child)
  }
  walk(tree)
  return found
}

export const Thumbnails: QuartzEmitterPlugin = () => ({
  name: "Thumbnails",
  async *emit(ctx, content) {
    const done = new Set<string>()
    for (const [tree, file] of content) {
      // A cover gets a WebP copy for the page (cover.tsx names it and gives its size); the
      // original stays for link previews.
      const cover = coverOf(file.data)
      const copy = coverCopyOf(file.data)
      if (cover && copy && !done.has(copy.path)) {
        done.add(copy.path)
        const out = joinSegments(ctx.argv.output, copy.path) as FilePath
        await fs.promises.mkdir(path.dirname(out), { recursive: true })
        await sharp(path.join(ctx.argv.directory, cover))
          .rotate()
          .resize({ width: COVER_WIDTH, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(out)
        yield out
      }
      const fm = (file.data.frontmatter ?? {}) as Record<string, unknown>
      if (fm.type !== "note" || !file.data.filePath?.endsWith(".md")) continue
      for (const src of pictures(tree as Root)) {
        const picture = pictureSlug(src, file.data.slug!)
        if (!picture || done.has(picture)) continue
        done.add(picture)
        const source = ctx.allFiles.find((fp) => slugifyFilePath(fp) === picture)
        if (!source) continue
        const out = joinSegments(ctx.argv.output, thumbPath(picture)) as FilePath
        await fs.promises.mkdir(path.dirname(out), { recursive: true })
        await sharp(path.join(ctx.argv.directory, source))
          .rotate()
          .resize({ width: WIDTH, withoutEnlargement: true })
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 80, mozjpeg: true })
          .toFile(out)
        yield out
      }
    }
  },
  async *partialEmit() {},
})
