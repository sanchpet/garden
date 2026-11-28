import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test, { describe } from "node:test"
import { render } from "preact-render-to-string"
import { feedCss } from "./feed-style"
import {
  caveatFace,
  faces,
  fallbackFaces,
  hashedName,
  holdRoman,
  neuchaFace,
  preloads,
  SiteFonts,
  SiteFontFaces,
  textFontFaces,
} from "./fonts"
import { GardenStyles } from "./garden-styles"

const HASHED = /-[0-9a-f]{8}\.woff2$/
const unhash = (name: string) => name.replace(/-[0-9a-f]{8}(\.woff2)$/, "$1")

const face = (name: string, range: string) => `/* ${name} */
@font-face {
  font-family: 'Literata Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 200 900;
  src: url(./files/${name}.woff2) format('woff2-variations');
  unicode-range: ${range};
}
`

describe("font faces", () => {
  test("Latin and Cyrillic with their -ext subsets, under the site's family name, from /static/fonts", () => {
    const css = [
      face("literata-cyrillic-ext-opsz-normal", "U+0460-052F"),
      face("literata-greek-opsz-normal", "U+0370-03FF"),
      face("literata-latin-opsz-normal", "U+0000-00FF"),
    ].join("\n")
    const found = faces(css, "Literata")
    assert.deepStrictEqual(found.files, [
      "literata-cyrillic-ext-opsz-normal.woff2",
      "literata-latin-opsz-normal.woff2",
    ])
    assert.ok(!found.css.includes("greek"))
    assert.ok(!found.css.includes("Literata Variable"))
    assert.match(found.css, /font-family: "Literata";/)
    assert.match(found.css, /url\(\/static\/fonts\/literata-latin-opsz-normal\.woff2\)/)
    assert.match(found.css, /unicode-range: U\+0460-052F;/)
  })

  test("a weight range replaces fontsource's", () => {
    const found = faces(face("literata-latin-opsz-normal", "U+0000-00FF"), "Literata", "400 900")
    assert.match(found.css, /font-weight: 400 900;/)
    assert.ok(!found.css.includes("200 900"))
  })

  test("fontsource's WOFF copy is not linked, only the WOFF2 the site serves", () => {
    const withWoff = face("ibm-plex-mono-latin-400-normal", "U+0000-00FF").replace(
      "format('woff2-variations');",
      "format('woff2'), url(./files/ibm-plex-mono-latin-400-normal.woff) format('woff');",
    )
    const found = faces(withWoff, "IBM Plex Mono")
    assert.doesNotMatch(found.css, /\.woff\)/)
    assert.match(
      found.css,
      /url\(\/static\/fonts\/ibm-plex-mono-latin-400-normal\.woff2\) format\('woff2'\);/,
    )
    assert.doesNotMatch(textFontFaces(), /\.woff\)/)
  })

  // The rules must claim the weights the cut files hold: a range wider than the file makes the
  // browser pick this face for weights it no longer has.
  test("Literata's weight range is the one brand/build.sh cuts the files to", () => {
    const cut = /"wght": \((\d+), (\d+)\)/.exec(
      fs.readFileSync("brand/src/crop_weight.py", "utf8"),
    )!
    const literata = textFontFaces()
      .match(/@font-face \{[^}]*\}/g)!
      .filter((rule) => rule.includes('"Literata"'))
    assert.ok(literata.length > 0)
    for (const rule of literata) assert.match(rule, new RegExp(`font-weight: ${cut[1]} ${cut[2]};`))
  })

  // The served Literata files are fontsource's, cut by brand/build.sh: after a fontsource bump the
  // set of files must still match, or the site would link files it does not have.
  test("brand/out/fonts holds exactly the Literata files the faces link", () => {
    const dir = "node_modules/@fontsource-variable/literata"
    const linked = ["opsz.css", "opsz-italic.css"].flatMap(
      (sheet) => faces(fs.readFileSync(`${dir}/${sheet}`, "utf8"), "Literata").files,
    )
    assert.deepStrictEqual([...linked].sort(), fs.readdirSync("brand/out/fonts").sort())
  })
})

describe("fallback faces", () => {
  const css = fallbackFaces()
  const rules = css.split("\n").filter((rule) => rule.startsWith("@font-face"))

  test("each takes a local face and the web font's room", () => {
    assert.ok(rules.length > 0)
    for (const rule of rules) {
      assert.match(rule, /src: local\("[^"]+"\)/)
      for (const descriptor of [
        "size-adjust",
        "ascent-override",
        "descent-override",
        "line-gap-override",
      ]) {
        assert.match(rule, new RegExp(`${descriptor}: [\\d.]+%;`))
      }
    }
  })

  // A later face is checked first where ranges overlap, so the Cyrillic ones must follow the Latin.
  test("the Cyrillic faces come after the unranged ones", () => {
    const literata = rules.filter((rule) => rule.includes('"Literata Fallback"'))
    const firstRanged = literata.findIndex((rule) => rule.includes("unicode-range"))
    assert.ok(firstRanged > 0)
    assert.ok(literata.slice(firstRanged).every((rule) => rule.includes("unicode-range")))
  })

  // quartz-fonts writes the stacks into --bodyFont and the heading rules; quartz.config.yaml sets them.
  test("the configured stacks put the fallback between the web font and the generic family", () => {
    const config = fs.readFileSync("quartz.config.yaml", "utf8")
    const fonts = config.slice(config.indexOf("@quartz-community/quartz-fonts"))
    for (const role of ["header", "body", "interface"]) {
      assert.match(fonts, new RegExp(`${role}: '"Literata", "Literata Fallback", serif'`))
    }
    assert.match(fonts, /code: '"IBM Plex Mono", "IBM Plex Mono Fallback", monospace'/)
  })
})

describe("preloads", () => {
  const head = (slug: string) =>
    preloads({ slug: slug as never })
      .map((link) => render(link))
      .join("")

  test("every page asks for the Latin roman face, a Russian one for the Cyrillic too", () => {
    assert.match(head("en/colophon"), /literata-latin-opsz-normal-[0-9a-f]{8}\.woff2/)
    assert.doesNotMatch(head("en/colophon"), /cyrillic/)
    assert.match(head("ru/colophon"), /literata-cyrillic-opsz-normal-[0-9a-f]{8}\.woff2/)
  })

  // A font preload without crossorigin is fetched twice: fonts are requested in CORS mode.
  test("each is a CORS font preload of a file the site serves", () => {
    const files = fs.readdirSync("brand/out/fonts")
    for (const link of preloads({ slug: "ru/a" as never })) {
      const html = render(link)
      assert.match(html, /rel="preload"/)
      assert.match(html, /as="font"/)
      assert.match(html, /crossorigin/)
      const name = /fonts\/([^"]+)"/.exec(html)![1]
      assert.match(name, HASHED)
      assert.ok(files.includes(unhash(name)))
    }
  })
})

describe("holding the roman faces", () => {
  const rules = holdRoman(textFontFaces()).match(/@font-face \{[^}]*\}/g)!

  test("only the preloaded faces wait for their files, the rest swap in", () => {
    const held = rules.filter((rule) => rule.includes("font-display: block;"))
    assert.deepStrictEqual(held.map((rule) => unhash(/fonts\/([^)]+)\)/.exec(rule)![1])).sort(), [
      "literata-cyrillic-opsz-normal.woff2",
      "literata-latin-opsz-normal.woff2",
    ])
    assert.ok(rules.filter((rule) => rule.includes("font-display: swap;")).length > 0)
  })

  // The feed's stylesheet loads none of them ahead, so it keeps swap everywhere.
  test("the feed's faces are left as fontsource writes them", () => {
    assert.doesNotMatch(textFontFaces(), /font-display: block/)
  })
})

describe("hashed font files", () => {
  test("a file's name carries the hash of its bytes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fonts-"))
    const write = (name: string, bytes: string) => {
      fs.writeFileSync(path.join(dir, name), bytes)
      return hashedName(path.join(dir, name))
    }
    const a = write("face.woff2", "one")
    assert.match(a, /^face-[0-9a-f]{8}\.woff2$/)
    assert.strictEqual(write("same.woff2", "one").slice(-14), a.slice(-14))
    assert.notStrictEqual(write("other.woff2", "two").slice(-14), a.slice(-14))
  })

  // A preload that names another URL than the stylesheet's is fetched for nothing, and the font
  // is fetched again: they must agree to the byte.
  test("each preload asks for a URL the page's stylesheet uses", () => {
    const css = SiteFontFaces().css!
    for (const slug of ["ru/a", "en/a"]) {
      for (const link of preloads({ slug: slug as never })) {
        const href = /href="([^"]+)"/.exec(render(link))![1]
        assert.ok(css.includes(`url(${href})`), href)
      }
    }
  })

  // Every stylesheet that sets a served font points at a hashed file the build writes.
  test("every font URL in the site's stylesheets is hashed and emitted", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "site-"))
    const ctx = { argv: { output: out } } as never
    const emitted: string[] = []
    for await (const file of SiteFonts().emit!(ctx, [], {} as never) as AsyncIterable<string>) {
      emitted.push(path.basename(file))
    }
    const sheets = [
      SiteFontFaces().css!,
      GardenStyles().css!,
      feedCss(textFontFaces()),
      caveatFace(),
      neuchaFace(),
    ].join("\n")
    const urls = [...sheets.matchAll(/url\("?([^)"]+\.woff2)"?\)/g)].map((m) => m[1])
    assert.ok(urls.length > 0)
    for (const url of urls) {
      assert.match(url, /^\/static\/fonts\//, url)
      assert.match(url, HASHED, url)
      assert.ok(emitted.includes(path.basename(url)), url)
    }
    for (const name of emitted) assert.match(name, HASHED)
    assert.ok(emitted.some((name) => name.startsWith("caveat-")))
    assert.ok(emitted.some((name) => name.startsWith("neucha-")))
  })

  // A font written into a stylesheet by hand would keep an address the build no longer serves.
  test("no stylesheet names a font file by hand", () => {
    for (const name of fs.readdirSync("local-plugins")) {
      if (!/\.tsx?$/.test(name) || name.endsWith(".test.ts")) continue
      const source = fs.readFileSync(path.join("local-plugins", name), "utf8")
      assert.doesNotMatch(source, /url\(["']?\/static\/[^)]*\.woff2/, name)
    }
  })
})
