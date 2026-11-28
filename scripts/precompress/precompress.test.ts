import assert from "node:assert"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import zlib from "node:zlib"
import test, { describe } from "node:test"
import { ETAG_SUFFIX, MIN_BYTES, brotli, etag, precompress, writeEtags } from "./precompress"

const text = (n: number) => "the quick brown fox jumps over the lazy dog\n".repeat(n)

function site(files: Record<string, string | Buffer>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "precompress-"))
  for (const [name, data] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), data)
  }
  return dir
}

describe("precompress", () => {
  test("text assets get a .br copy that decodes to the original, in subfolders too", () => {
    const dir = site({
      "index.html": text(100),
      "static/app.js": text(80),
      "ru/feed.xml": text(60),
    })
    const totals = precompress(dir)
    assert.strictEqual(totals.files, 3)
    for (const name of ["index.html", "static/app.js", "ru/feed.xml"]) {
      const original = fs.readFileSync(path.join(dir, name))
      const br = fs.readFileSync(path.join(dir, `${name}.br`))
      assert.deepStrictEqual(zlib.brotliDecompressSync(br), original)
    }
  })

  test("small files, binary formats and incompressible data are left alone", () => {
    const noise = crypto.randomBytes(4096)
    const dir = site({
      "tiny.css": "a{}",
      "edge.css": "x".repeat(MIN_BYTES - 1),
      "cover.webp": text(100),
      "font.woff2": text(100),
      "noise.json": noise,
    })
    assert.strictEqual(precompress(dir).files, 0)
    assert.deepStrictEqual(
      fs.readdirSync(dir).filter((f) => f.endsWith(".br")),
      [],
    )
  })

  test("the same input gives the same bytes, so an unchanged file does not churn the branch", () => {
    const data = Buffer.from(text(200))
    assert.deepStrictEqual(brotli(data), brotli(Buffer.from(data)))
  })

  // At the top quality a minified library comes out about 17% under gzip -9; a lower one does not.
  test("compresses at the top quality, well under the best gzip", () => {
    const data = fs.readFileSync("node_modules/katex/dist/katex.min.js")
    assert.ok(brotli(data).length < zlib.gzipSync(data, { level: 9 }).length * 0.86)
  })
})

describe("writeEtags", () => {
  test("every file and its .br copy get a quoted validator taken from their own bytes", () => {
    const dir = site({ "ru/index.html": text(100), "static/cover.webp": text(3) })
    precompress(dir)
    assert.strictEqual(writeEtags(dir), 3)
    for (const name of ["ru/index.html", "ru/index.html.br", "static/cover.webp"]) {
      const tag = fs.readFileSync(path.join(dir, name + ETAG_SUFFIX), "utf8")
      assert.match(tag, /^"[A-Za-z0-9_-]{22}"$/)
      assert.strictEqual(tag, etag(fs.readFileSync(path.join(dir, name))))
    }
    const html = fs.readFileSync(path.join(dir, "ru/index.html.etag"), "utf8")
    assert.notStrictEqual(html, fs.readFileSync(path.join(dir, "ru/index.html.br.etag"), "utf8"))
  })

  test("the same content gets the same validator on any checkout, other content another", () => {
    const a = site({ "a.css": "a{color:red}" })
    const b = site({ "b/a.css": "a{color:red}", "c.css": "a{color:blue}" })
    writeEtags(a)
    writeEtags(b)
    const read = (d: string, n: string) => fs.readFileSync(path.join(d, n + ETAG_SUFFIX), "utf8")
    assert.strictEqual(read(a, "a.css"), read(b, "b/a.css"))
    assert.notStrictEqual(read(b, "b/a.css"), read(b, "c.css"))
  })

  test("a second run does not tag the tags", () => {
    const dir = site({ "a.css": "a{}" })
    writeEtags(dir)
    assert.strictEqual(writeEtags(dir), 1)
    assert.ok(!fs.existsSync(path.join(dir, "a.css.etag.etag")))
  })
})
