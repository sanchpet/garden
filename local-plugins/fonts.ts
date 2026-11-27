import fs from "node:fs"
import path from "node:path"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzEmitterPlugin } from "../quartz/plugins/types"
import { FilePath, joinSegments } from "../quartz/util/path"

// The text fonts are served by the site itself, not by Google Fonts: a page must not depend on
// a third-party host to be read. The @font-face rules come from the fontsource packages, cut to
// the scripts the texts use; a script's -ext subset comes with it.
const SCRIPTS = ["latin", "cyrillic"]
const OUT = "static/fonts"

type Source = { dir: string; css: string[]; family: string }
const SOURCES: Source[] = [
  // The opsz files carry both axes, so headings and body text get their optical sizes.
  {
    dir: "node_modules/@fontsource-variable/literata",
    css: ["opsz.css", "opsz-italic.css"],
    family: "Literata",
  },
  {
    dir: "node_modules/@fontsource/ibm-plex-mono",
    css: ["400.css", "600.css"],
    family: "IBM Plex Mono",
  },
]

const FACE = /\/\* ([\w-]+) \*\/\s*@font-face \{([^}]*)\}/g

// The @font-face rules of one fontsource stylesheet for SCRIPTS, under `family`, with their
// files at /static/fonts; also the names of those files.
export function faces(css: string, family: string): { css: string; files: string[] } {
  const out: string[] = []
  const files: string[] = []
  for (const [, name, body] of css.matchAll(FACE)) {
    if (!SCRIPTS.some((script) => name.includes(`-${script}-`))) continue
    const file = /url\(\.\/files\/([^)]+)\)/.exec(body)?.[1]
    if (!file) continue
    files.push(file)
    const rule = body
      .replace(/font-family: [^;]+;/, `font-family: "${family}";`)
      .replace(`./files/${file}`, `/${OUT}/${file}`)
    out.push(`@font-face {${rule}}`)
  }
  return { css: out.join("\n"), files }
}

function load() {
  const css: string[] = []
  const files: string[] = []
  for (const source of SOURCES) {
    for (const sheet of source.css) {
      const found = faces(fs.readFileSync(path.join(source.dir, sheet), "utf8"), source.family)
      css.push(found.css)
      files.push(...found.files.map((file) => path.join(source.dir, "files", file)))
    }
  }
  return { css: css.join("\n"), files }
}

export const SiteFonts: QuartzEmitterPlugin = () => ({
  name: "SiteFonts",
  async *emit(ctx) {
    for (const file of load().files) {
      const out = joinSegments(ctx.argv.output, OUT, path.basename(file)) as FilePath
      await fs.promises.mkdir(path.dirname(out), { recursive: true })
      await fs.promises.copyFile(file, out)
      yield out
    }
  },
  async *partialEmit() {},
})

export const SiteFontFaces = (() => {
  const Faces: QuartzComponent = () => null
  Faces.css = load().css
  return Faces
}) satisfies QuartzComponentConstructor
