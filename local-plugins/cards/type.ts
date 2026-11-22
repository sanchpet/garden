import path from "node:path"
import * as fontkit from "fontkit"

// Text on a card is set as outlines from the font files in brand/fonts: the rasteriser then
// needs no installed fonts, and a card comes out the same on a laptop and in CI.
const FONTS = path.join(process.cwd(), "brand", "fonts")

const FACES = {
  title: ["Literata[opsz,wght].ttf", { wght: 700, opsz: 36 }],
  text: ["Literata[opsz,wght].ttf", { wght: 400, opsz: 24 }],
  italic: ["Literata-Italic[opsz,wght].ttf", { wght: 400, opsz: 24 }],
  hand: ["Caveat[wght].ttf", { wght: 700 }],
} as const

export type Face = keyof typeof FACES

const loaded = new Map<Face, fontkit.Font>()

function font(face: Face): fontkit.Font {
  let found = loaded.get(face)
  if (!found) {
    const [file, axes] = FACES[face]
    found = (fontkit.openSync(path.join(FONTS, file)) as fontkit.Font).getVariation(axes)
    loaded.set(face, found)
  }
  return found
}

export function widthOf(text: string, face: Face, size: number): number {
  const f = font(face)
  return (f.layout(text).advanceWidth * size) / f.unitsPerEm
}

// Greedy wrap by words; what does not fit into `lines` is cut and the last line ends with «…».
export function wrap(text: string, face: Face, size: number, width: number, lines: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  const out: string[] = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (!line || widthOf(next, face, size) <= width) line = next
    else {
      out.push(line)
      line = word
    }
  }
  if (line) out.push(line)
  if (out.length <= lines) return out
  let last = out[lines - 1]
  while (last && widthOf(`${last}…`, face, size) > width) last = last.replace(/\s*\S+$/, "")
  return [...out.slice(0, lines - 1), `${last.replace(/[\s,;:.—–-]+$/, "")}…`]
}

// The largest of `sizes` at which the text fits the width in `lines` lines without being cut.
export function fit(text: string, face: Face, sizes: number[], width: number, lines: number) {
  for (const size of sizes) {
    const wrapped = wrap(text, face, size, width, lines + 1)
    if (wrapped.length <= lines && wrapped.every((l) => widthOf(l, face, size) <= width))
      return { size, lines: wrapped }
  }
  const size = sizes[sizes.length - 1]
  return { size, lines: wrap(text, face, size, width, lines) }
}

// One line as an SVG path, its baseline starting at (x, y).
export function outline(text: string, face: Face, size: number, x: number, y: number): string {
  const f = font(face)
  const scale = size / f.unitsPerEm
  const run = f.layout(text)
  let pen = 0
  let d = ""
  run.glyphs.forEach((glyph, i) => {
    const at = run.positions[i]
    d += glyph.path
      .scale(scale, -scale)
      .translate(x + (pen + at.xOffset) * scale, y - at.yOffset * scale)
      .toSVG()
    pen += at.xAdvance
  })
  return d
}

export function lineHeight(face: Face, size: number): number {
  return size * (face === "hand" ? 1.05 : 1.22)
}
