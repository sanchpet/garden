import fs from "node:fs"
import path from "node:path"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"
import { frontmatterOf } from "./frontmatter"
import { isSource } from "./kinds"
import { LANGUAGES, languageOf } from "./languages"

// What a source is and where the reading stands, whatever language its card is in. The card
// that sets them (the Russian one, with the status buttons) is the only writer; its translation
// carries the words and takes the rest from it.
export const SHARED = [
  "id",
  "status",
  "created",
  "started",
  "finished",
  "cover",
  "spine",
  "year",
  "queue",
  "want",
  "demand",
  "chunks",
] as const

// Set on a card whose other-language card exists, so a base view can list each source once.
export const TWINNED = "twinned"

export function fillFromTwin(
  own: Record<string, unknown>,
  twin: Record<string, unknown>,
): Record<string, unknown> {
  const filled = { ...own }
  for (const key of SHARED) {
    if (filled[key] === undefined || filled[key] === null) {
      if (twin[key] !== undefined && twin[key] !== null) filled[key] = twin[key]
    }
  }
  return filled
}

// The same file under the other languages' folders.
export function twinFiles(relativePath: string): string[] {
  const own = languageOf(relativePath)
  if (!own) return []
  const rest = relativePath.slice(relativePath.indexOf("/"))
  return LANGUAGES.filter((lang) => lang !== own).map((lang) => `${lang}${rest}`)
}

export const CatalogueTwins: QuartzTransformerPlugin = () => ({
  name: "CatalogueTwins",
  markdownPlugins(ctx) {
    const files = new Set(ctx.allFiles)
    return [
      () => (_tree, file) => {
        const fm = file.data.frontmatter as Record<string, unknown> | undefined
        const own = file.data.relativePath
        if (!fm || !own || !isSource(fm.type)) return
        for (const twin of twinFiles(own)) {
          if (!files.has(twin as never)) continue
          const other = frontmatterOf(fs.readFileSync(path.join(ctx.argv.directory, twin), "utf8"))
          if (!other || !isSource(other.type)) continue
          Object.assign(fm, fillFromTwin(fm, other), { [TWINNED]: true })
        }
      },
    ]
  },
})
