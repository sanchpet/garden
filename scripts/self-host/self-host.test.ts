import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test, { describe } from "node:test"
import { LIBRARIES, leftovers, rewrite, selfHost } from "./self-host"

const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/"

describe("rewrite", () => {
  test("library addresses point at the site", () => {
    assert.strictEqual(
      rewrite(`<link href="${KATEX}katex.min.css" rel="stylesheet"/>`),
      `<link href="/static/vendor/katex/katex.min.css" rel="stylesheet"/>`,
    )
    assert.strictEqual(
      rewrite(`l("https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.js")`),
      `l("/static/vendor/pixi.js/pixi.min.js")`,
    )
    assert.strictEqual(
      rewrite(
        `import("https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.0/mermaid.esm.min.mjs")`,
      ),
      `import("/static/vendor/mermaid/mermaid.esm.min.js")`,
    )
  })

  test("connection hints to CDNs are dropped", () => {
    assert.strictEqual(
      rewrite(`<link rel="preconnect" href="https://cdnjs.cloudflare.com"/><title>x</title>`),
      "<title>x</title>",
    )
  })
})

describe("leftovers", () => {
  test("markup: a script or stylesheet on a CDN, not a link in the text", () => {
    const html = `<script src="https://unpkg.com/x.js"></script><a href="https://unpkg.com/">unpkg</a>`
    assert.deepStrictEqual(leftovers(html, ".html"), ["https://unpkg.com/x.js"])
  })

  test("scripts and stylesheets: any CDN address", () => {
    assert.deepStrictEqual(leftovers(`load("https://cdn.jsdelivr.net/npm/y@1/y.js")`, ".js"), [
      "https://cdn.jsdelivr.net/npm/y@1/y.js",
    ])
    assert.deepStrictEqual(leftovers(`url(https://fonts.gstatic.com/a.woff2)`, ".css"), [
      "https://fonts.gstatic.com/a.woff2",
    ])
    assert.deepStrictEqual(
      leftovers(`fetch("https://tile.openstreetmap.org/1/2/3.png")`, ".js"),
      [],
    )
  })
})

// node_modules with every library at its expected version, each file holding its own name.
function modules(root: string, versions: Record<string, string> = {}) {
  for (const lib of LIBRARIES) {
    const dist = path.join(root, lib.pkg, lib.dist)
    const version =
      versions[lib.pkg] ?? (lib.version.includes(".") ? lib.version : `${lib.version}.0.0`)
    fs.mkdirSync(dist, { recursive: true })
    fs.writeFileSync(path.join(root, lib.pkg, "package.json"), JSON.stringify({ version }))
    for (const file of lib.files) {
      const name = file.replace("/*", "/sample")
      fs.mkdirSync(path.dirname(path.join(dist, name)), { recursive: true })
      fs.writeFileSync(path.join(dist, name), name)
    }
    if (lib.pkg === "mermaid") {
      fs.writeFileSync(
        path.join(dist, "mermaid.esm.min.mjs"),
        `import{a}from"./chunks/mermaid.esm.min/sample.mjs";import("./chunks/mermaid.esm.min/b.mjs");const s="x.mjs"`,
      )
    }
  }
}

describe("selfHost", () => {
  test("copies the libraries, rewrites the site and names what is left", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "self-host-"))
    const out = path.join(tmp, "public")
    modules(path.join(tmp, "node_modules"))
    fs.mkdirSync(path.join(out, "ru"), { recursive: true })
    fs.writeFileSync(
      path.join(out, "ru", "a.html"),
      `<link href="${KATEX}katex.min.css" rel="stylesheet"/>`,
    )
    fs.writeFileSync(path.join(out, "post.js"), `l("https://unpkg.com/z.js")`)

    const left = selfHost(out, path.join(tmp, "node_modules"))

    assert.deepStrictEqual(left, ["post.js: https://unpkg.com/z.js"])
    assert.ok(
      fs.readFileSync(path.join(out, "ru", "a.html"), "utf8").includes("/static/vendor/katex/"),
    )
    assert.ok(fs.existsSync(path.join(out, "static/vendor/katex/katex.min.css")))
    // ES modules are served as .js, their imports of one another rewritten to match.
    assert.ok(
      fs.existsSync(path.join(out, "static/vendor/mermaid/chunks/mermaid.esm.min/sample.js")),
    )
    assert.strictEqual(
      fs.readFileSync(path.join(out, "static/vendor/mermaid/mermaid.esm.min.js"), "utf8"),
      `import{a}from"./chunks/mermaid.esm.min/sample.js";import("./chunks/mermaid.esm.min/b.js");const s="x.mjs"`,
    )
    assert.ok(fs.existsSync(path.join(out, "static/vendor/leaflet/images/sample.png")))
  })

  test("refuses a library at another version than the plugins load", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "self-host-"))
    modules(path.join(tmp, "node_modules"), { katex: "0.16.12" })
    fs.mkdirSync(path.join(tmp, "public"))
    assert.throws(
      () => selfHost(path.join(tmp, "public"), path.join(tmp, "node_modules")),
      /katex 0\.16\.12/,
    )
  })
})
