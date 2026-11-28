import assert from "node:assert"
import fs from "node:fs"
import test, { describe } from "node:test"
import { faces } from "./fonts"

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
