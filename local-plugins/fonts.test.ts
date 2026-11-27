import assert from "node:assert"
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
})
