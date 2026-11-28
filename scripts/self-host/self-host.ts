import fs from "node:fs"
import path from "node:path"

// Quartz's plugins load KaTeX, Mermaid, the graph's d3 and pixi.js and the race map's Leaflet
// from public CDNs, with the addresses written into their code. A reader on a network that
// throttles those hosts would get raw diagram code and broken formulas, so after the build the
// files are copied onto the site from node_modules and the addresses rewritten to them.

export type Library = {
  // The address prefix the plugins use; the rest of each address is a path under `dist`.
  url: string
  pkg: string
  // The installed version: a major one for a range like d3@7, the exact one otherwise. It may be
  // newer than the one in `url` when a security fix is installed ahead of the plugin's address.
  version: string
  dist: string
  // Paths under `dist` to copy; a trailing /* takes the directory's files with that extension.
  files: string[]
  // Address remainders served by another file, e.g. the unminified build by the minified one.
  alias?: Record<string, string>
}

export const LIBRARIES: Library[] = [
  {
    url: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/",
    pkg: "katex",
    // The latex plugin renders with its bundled KaTeX 0.16.47; the stylesheet must be the same
    // version, since 0.17 renamed the classes it styles.
    version: "0.16.47",
    dist: "dist",
    // The stylesheet lists woff2 first; every browser that runs the site takes it.
    files: ["katex.min.css", "contrib/copy-tex.min.js", "fonts/*.woff2"],
  },
  {
    url: "https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.0/",
    pkg: "mermaid",
    version: "11.17.2",
    dist: "dist",
    files: ["mermaid.esm.min.mjs", "chunks/mermaid.esm.min/*.mjs"],
  },
  {
    url: "https://cdn.jsdelivr.net/npm/d3@7/dist/",
    pkg: "d3",
    version: "7",
    dist: "dist",
    files: ["d3.min.js"],
  },
  {
    url: "https://cdn.jsdelivr.net/npm/pixi.js@8/dist/",
    pkg: "pixi.js",
    version: "8",
    dist: "dist",
    files: ["pixi.min.js"],
    alias: { "pixi.js": "pixi.min.js" },
  },
  {
    url: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/",
    pkg: "leaflet",
    version: "1.9.4",
    dist: "dist",
    files: ["leaflet.css", "leaflet.js", "images/*.png"],
  },
  {
    url: "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/",
    pkg: "leaflet.markercluster",
    version: "1.5.3",
    dist: "dist",
    files: ["MarkerCluster.css", "MarkerCluster.Default.css", "leaflet.markercluster.js"],
  },
]

export const VENDOR = "/static/vendor"
// The site's server types .mjs as application/octet-stream, and a browser will not run a module
// served so; ES modules are copied as .js and their imports of one another rewritten.
const MODULE = /\.mjs$/
const esc = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
export const local = (lib: Library) => `${VENDOR}/${lib.pkg}/`

// Hosts that serve code or styles; a reference to one left after the rewrite fails the build.
// Map tiles (tile.openstreetmap.org) are data, not code, and stay where they are.
export const CDN_HOSTS = [
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "unpkg.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "esm.sh",
  "cdn.skypack.dev",
]
const host = CDN_HOSTS.map((h) => h.replaceAll(".", "\\.")).join("|")

// A hint to open a connection to a CDN, which nothing on the page uses any more.
const PRECONNECT = new RegExp(
  `<link rel="(?:preconnect|dns-prefetch)" href="https://(?:${host})"[^>]*>`,
  "g",
)

export function rewrite(text: string): string {
  let out = text.replace(PRECONNECT, "")
  for (const lib of LIBRARIES) {
    for (const [from, to] of Object.entries(lib.alias ?? {})) {
      out = out.replaceAll(lib.url + from, local(lib) + to)
    }
    out = out.replace(
      new RegExp(`${esc(lib.url)}([^"'\`\\s)]*?)\\.mjs\\b`, "g"),
      `${local(lib)}$1.js`,
    )
    out = out.replaceAll(lib.url, local(lib))
  }
  return out
}

// Where a page or script still points at a CDN: in markup, a <script> or <link> to it; in a
// script or a stylesheet, any address on it.
export function leftovers(text: string, ext: string): string[] {
  const pattern =
    ext === ".html"
      ? new RegExp(`<(?:script|link)\\b[^>]*\\b(?:src|href)="(https://(?:${host})[^"]*)"`, "g")
      : new RegExp(`(https://(?:${host})[^"'\`)\\s]*)`, "g")
  return [...text.matchAll(pattern)].map((m) => m[1])
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

function expand(root: string, pattern: string): string[] {
  if (!/\/\*\.\w+$/.test(pattern)) return [pattern]
  const dir = path.dirname(pattern)
  const ext = path.extname(pattern)
  return fs
    .readdirSync(path.join(root, dir))
    .filter((name) => name.endsWith(ext))
    .map((name) => path.join(dir, name))
}

// Copies the libraries into `out` and rewrites its files; returns the addresses left on a CDN.
export function selfHost(out: string, modules = "node_modules"): string[] {
  for (const lib of LIBRARIES) {
    const pkg = path.join(modules, lib.pkg)
    const { version } = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8"))
    if (version !== lib.version && !version.startsWith(`${lib.version}.`)) {
      throw new Error(`${lib.pkg} ${version} is installed, the site expects ${lib.version}`)
    }
    const root = path.join(pkg, lib.dist)
    for (const file of lib.files.flatMap((pattern) => expand(root, pattern))) {
      const dest = path.join(out, local(lib), file.replace(MODULE, ".js"))
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      if (MODULE.test(file)) {
        const text = fs.readFileSync(path.join(root, file), "utf8")
        fs.writeFileSync(dest, text.replace(/(["'`]\.{1,2}\/[^"'`]*?)\.mjs(["'`])/g, "$1.js$2"))
      } else {
        fs.copyFileSync(path.join(root, file), dest)
      }
    }
  }
  const left: string[] = []
  for (const file of walk(out)) {
    const ext = path.extname(file)
    if (![".html", ".js", ".mjs", ".css"].includes(ext)) continue
    if (file.startsWith(path.join(out, VENDOR))) continue
    const text = fs.readFileSync(file, "utf8")
    const fixed = rewrite(text)
    if (fixed !== text) fs.writeFileSync(file, fixed)
    left.push(...leftovers(fixed, ext).map((url) => `${path.relative(out, file)}: ${url}`))
  }
  return [...new Set(left)]
}
