import fs from "node:fs"
import path from "node:path"
import type { QuartzEmitterPlugin } from "../quartz/plugins/types"
import { escapeHTML } from "../quartz/util/escape"
import { FilePath, joinSegments } from "../quartz/util/path"
import { languageOf } from "./bilingual"
import { coverOf } from "./cover"

// Telegram's link-preview servers cannot reach the hub in Russia, so links shared there go
// through SHARE_HOST (GitHub Pages): a stub per page carries the preview tags and sends the
// reader on to the site. publish.yaml moves SHARE_DIR out of the build into the `share` branch.
export const SHARE_HOST = "l.sanch.pet"
export const SHARE_DIR = ".share"
const SITE = "https://sanch.pet"

function page(lang: string, title: string, description: string, image: string, target: string) {
  const [t, d, i, u] = [title, description, image, target].map(escapeHTML)
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:site_name" content="${lang === "en" ? "Learning to think" : "Учусь мыслить"}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${i}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${u}">
<meta http-equiv="refresh" content="0; url=${u}">
<script>location.replace(${JSON.stringify(target)})</script>
</head>
<body><a href="${u}">${t}</a></body>
</html>
`
}

export const ShareStubs: QuartzEmitterPlugin = () => ({
  name: "ShareStubs",
  async *emit(ctx, content) {
    const out = (rel: string) => joinSegments(ctx.argv.output, SHARE_DIR, rel) as FilePath
    const write = async (rel: string, data: string | Buffer) => {
      const fp = out(rel)
      await fs.promises.mkdir(path.dirname(fp), { recursive: true })
      await fs.promises.writeFile(fp, data)
      return fp
    }
    const copy = async (rel: string, src: string) => {
      const fp = out(rel)
      await fs.promises.mkdir(path.dirname(fp), { recursive: true })
      await fs.promises.copyFile(src, fp)
      return fp
    }

    for (const lang of ["ru", "en"]) {
      yield await copy(
        `static/og-image-${lang}.png`,
        path.join("brand", "out", `og-image-${lang}.png`),
      )
    }
    for (const [, file] of content) {
      // Notes only: tag and folder listings are virtual pages with no source file.
      if (!file.data.filePath?.endsWith(".md")) continue
      const slug = file.data.slug!
      const lang = languageOf(slug) ?? "ru"
      const fm = (file.data.frontmatter ?? {}) as Record<string, unknown>
      const cover = coverOf(file.data)
      if (cover) yield await copy(cover, path.join(ctx.argv.directory, cover))
      const image = cover
        ? `https://${SHARE_HOST}/${encodeURI(cover)}`
        : `https://${SHARE_HOST}/static/og-image-${lang}.png`
      const target = `${SITE}/${slug.replace(/(^|\/)index$/, "$1")}`
      const title = String(fm.title ?? slug)
      const description = String(fm.description ?? file.data.description ?? "")
      yield await write(`${slug}.html`, page(lang, title, description, image, target))
    }
    yield await write("CNAME", `${SHARE_HOST}\n`)
    yield await write(".nojekyll", "")
  },
  async *partialEmit() {},
})
