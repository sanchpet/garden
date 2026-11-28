import fs from "node:fs"
import path from "node:path"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { Fragment, h } from "preact"
import type { QuartzEmitterPlugin } from "../quartz/plugins/types"
import type { QuartzPluginData } from "../quartz/plugins/vfile"
import { FilePath, joinSegments } from "../quartz/util/path"
import { languageOf } from "./languages"

// The text fonts are served by the site itself, not by Google Fonts: a page must not depend on
// a third-party host to be read. The @font-face rules come from the fontsource packages, cut to
// the scripts the texts use; a script's -ext subset comes with it.
const SCRIPTS = ["latin", "cyrillic"]
const OUT = "static/fonts"

// `files`: where the served files come from when they are not fontsource's own; `weight`: their
// font-weight range, when they differ from fontsource's.
type Source = { dir: string; css: string[]; family: string; files?: string; weight?: string }
const SOURCES: Source[] = [
  // The opsz files carry both axes, so headings and body text get their optical sizes.
  {
    dir: "node_modules/@fontsource-variable/literata",
    css: ["opsz.css", "opsz-italic.css"],
    family: "Literata",
    // brand/build.sh drops the weights under 400, which the site never sets: a fifth of each file.
    files: "brand/out/fonts",
    weight: "400 900",
  },
  {
    dir: "node_modules/@fontsource/ibm-plex-mono",
    css: ["400.css", "600.css"],
    family: "IBM Plex Mono",
  },
]

const FACE = /\/\* ([\w-]+) \*\/\s*@font-face \{([^}]*)\}/g

// The @font-face rules of one fontsource stylesheet for SCRIPTS, under `family` and, if given,
// with `weight` as their range, with their files at /static/fonts; also the names of those files.
export function faces(
  css: string,
  family: string,
  weight?: string,
): { css: string; files: string[] } {
  const out: string[] = []
  const files: string[] = []
  for (const [, name, body] of css.matchAll(FACE)) {
    if (!SCRIPTS.some((script) => name.includes(`-${script}-`))) continue
    const file = /url\(\.\/files\/([^)]+)\)/.exec(body)?.[1]
    if (!file) continue
    files.push(file)
    let rule = body
      .replace(/font-family: [^;]+;/, `font-family: "${family}";`)
      .replace(`./files/${file}`, `/${OUT}/${file}`)
    if (weight) rule = rule.replace(/font-weight: [^;]+;/, `font-weight: ${weight};`)
    out.push(`@font-face {${rule}}`)
  }
  return { css: out.join("\n"), files }
}

function load() {
  const css: string[] = []
  const files: string[] = []
  for (const source of SOURCES) {
    for (const sheet of source.css) {
      const sheetCss = fs.readFileSync(path.join(source.dir, sheet), "utf8")
      const found = faces(sheetCss, source.family, source.weight)
      css.push(found.css)
      const dir = source.files ?? path.join(source.dir, "files")
      files.push(...found.files.map((file) => path.join(dir, file)))
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
  externalResources: () => ({
    additionalHead: [(page: QuartzPluginData) => h(Fragment, null, preloads(page))],
  }),
})

// The roman text faces, which every page of a language sets from its first line. They are asked
// for with the stylesheet and held back from the first paint until they arrive (at most 3 s, then
// the fallback below): with swap, a page drawn in the fallback rewrapped a line or two when they
// came. The rest wait for the text to need them and swap in.
const ROMAN = {
  latin: "literata-latin-opsz-normal.woff2",
  cyrillic: "literata-cyrillic-opsz-normal.woff2",
}

export function preloads(page: Pick<QuartzPluginData, "slug">) {
  const files = [ROMAN.latin]
  if (languageOf(page.slug) === "ru") files.push(ROMAN.cyrillic)
  return files.map((file) =>
    h("link", {
      rel: "preload",
      href: `/${OUT}/${file}`,
      as: "font",
      type: "font/woff2",
      crossOrigin: "",
    }),
  )
}

export function holdRoman(css: string): string {
  return css.replace(/@font-face \{[^}]*\}/g, (rule) =>
    Object.values(ROMAN).some((file) => rule.includes(`/${file}`))
      ? rule.replace("font-display: swap;", "font-display: block;")
      : rule,
  )
}

// Until a web font arrives the page is drawn in a local face; where its width and line height
// differ, the page jumps on the swap. These faces take the room the web fonts will take:
// brand/src/fallback_metrics.py computes the overrides by setting the texts in the shipped
// files and in the local faces. Times New Roman and Courier New are on macOS,
// iOS and Windows; elsewhere the stack falls through to the generic family as before.
type Metrics = { size: number; ascent: number; descent: number; lineGap: number }
type Fallback = { family: string; local: string[]; weight: string; style: string; range?: string }
const CYRILLIC_RANGE = "U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"
const FALLBACKS: [Fallback, Metrics][] = [
  [
    {
      family: "Literata Fallback",
      local: ["Times New Roman", "TimesNewRomanPSMT"],
      weight: "400",
      style: "normal",
    },
    { size: 117.11, ascent: 100.51, descent: 26.3, lineGap: 0 },
  ],
  [
    {
      family: "Literata Fallback",
      local: ["Times New Roman Bold", "TimesNewRomanPS-BoldMT"],
      weight: "500 900",
      style: "normal",
    },
    { size: 114.39, ascent: 102.89, descent: 26.92, lineGap: 0 },
  ],
  [
    {
      family: "Literata Fallback",
      local: ["Times New Roman Italic", "TimesNewRomanPS-ItalicMT"],
      weight: "400 900",
      style: "italic",
    },
    { size: 110.01, ascent: 106.99, descent: 28.0, lineGap: 0 },
  ],
  // Declared after the Latin faces, so they are checked first for the letters in their range.
  [
    {
      family: "Literata Fallback",
      local: ["Times New Roman", "TimesNewRomanPSMT"],
      weight: "400",
      style: "normal",
      range: CYRILLIC_RANGE,
    },
    { size: 118.3, ascent: 99.49, descent: 26.03, lineGap: 0 },
  ],
  [
    {
      family: "Literata Fallback",
      local: ["Times New Roman Bold", "TimesNewRomanPS-BoldMT"],
      weight: "500 900",
      style: "normal",
      range: CYRILLIC_RANGE,
    },
    { size: 114.5, ascent: 102.8, descent: 26.9, lineGap: 0 },
  ],
  [
    {
      family: "Literata Fallback",
      local: ["Times New Roman Italic", "TimesNewRomanPS-ItalicMT"],
      weight: "400 900",
      style: "italic",
      range: CYRILLIC_RANGE,
    },
    { size: 109.56, ascent: 107.43, descent: 28.11, lineGap: 0 },
  ],
  [
    {
      family: "IBM Plex Mono Fallback",
      local: ["Courier New", "CourierNewPSMT"],
      weight: "400 700",
      style: "normal",
    },
    { size: 99.98, ascent: 102.52, descent: 27.5, lineGap: 0 },
  ],
]

export function fallbackFaces(): string {
  const rules = FALLBACKS.map(([face, m]) => {
    const src = face.local.map((name) => `local("${name}")`).join(", ")
    const range = face.range ? ` unicode-range: ${face.range};` : ""
    return `@font-face { font-family: "${face.family}"; src: ${src}; font-weight: ${face.weight}; font-style: ${face.style}; size-adjust: ${m.size}%; ascent-override: ${m.ascent}%; descent-override: ${m.descent}%; line-gap-override: ${m.lineGap}%;${range} }`
  })
  return rules.join("\n")
}

// The same rules for a stylesheet outside the pages, such as the feed's.
export function textFontFaces(): string {
  return load().css
}

export const SiteFontFaces = (() => {
  const Faces: QuartzComponent = () => null
  Faces.css = `${holdRoman(load().css)}\n${fallbackFaces()}`
  return Faces
}) satisfies QuartzComponentConstructor
