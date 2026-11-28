import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

// The web server sends a `.br` file next to the requested one to readers that accept brotli.
// Compressing here at the top level costs seconds once per build, where the server could only
// afford a fast level on every request. Gzip stays on the server: only non-browser clients use it.

export const COMPRESSIBLE = /\.(?:html|css|js|mjs|json|xml|svg|txt|map|webmanifest)$/
// Below this, headers outweigh the saving.
export const MIN_BYTES = 1024

export function brotli(data: Buffer): Buffer {
  return zlib.brotliCompressSync(data, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
    },
  })
}

export type Totals = { files: number; raw: number; compressed: number }

export function precompress(dir: string): Totals {
  const totals: Totals = { files: 0, raw: 0, compressed: 0 }
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !COMPRESSIBLE.test(entry.name)) continue
    const file = path.join(entry.parentPath, entry.name)
    const data = fs.readFileSync(file)
    if (data.length < MIN_BYTES) continue
    const br = brotli(data)
    // A file that barely shrinks is not worth a second copy on the public branch.
    if (br.length > data.length * 0.9) continue
    fs.writeFileSync(`${file}.br`, br)
    totals.files++
    totals.raw += data.length
    totals.compressed += br.length
  }
  return totals
}
