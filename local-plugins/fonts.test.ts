import assert from "node:assert"
import fs from "node:fs"
import test, { describe } from "node:test"
import { render } from "preact-render-to-string"
import { faces, fallbackFaces, holdRoman, preloads, textFontFaces } from "./fonts"

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
    assert.match(head("en/colophon"), /literata-latin-opsz-normal\.woff2/)
    assert.doesNotMatch(head("en/colophon"), /cyrillic/)
    assert.match(head("ru/colophon"), /literata-cyrillic-opsz-normal\.woff2/)
  })

  // A font preload without crossorigin is fetched twice: fonts are requested in CORS mode.
  test("each is a CORS font preload of a file the site serves", () => {
    const files = fs.readdirSync("brand/out/fonts")
    for (const link of preloads({ slug: "ru/a" as never })) {
      const html = render(link)
      assert.match(html, /rel="preload"/)
      assert.match(html, /as="font"/)
      assert.match(html, /crossorigin/)
      assert.ok(files.includes(/fonts\/([^"]+)"/.exec(html)![1]))
    }
  })
})

describe("holding the roman faces", () => {
  const rules = holdRoman(textFontFaces()).match(/@font-face \{[^}]*\}/g)!

  test("only the preloaded faces wait for their files, the rest swap in", () => {
    const held = rules.filter((rule) => rule.includes("font-display: block;"))
    assert.deepStrictEqual(held.map((rule) => /fonts\/([^)]+)\)/.exec(rule)![1]).sort(), [
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
