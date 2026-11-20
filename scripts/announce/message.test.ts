import assert from "node:assert"
import fs from "node:fs"
import test, { describe } from "node:test"
import { loadConfig } from "./config"
import { buildText, escapeHtml, messageUrl, stubUrl } from "./message"

const entry = { id: "https://sanch.pet/ru/posts/a", title: "A", categories: [], related: [] }
const LINK = "https://l.sanch.pet/ru/posts/a"

describe("stubUrl", () => {
  test("keeps the path and swaps the host", () => {
    assert.strictEqual(
      stubUrl("https://sanch.pet/ru/posts/za-sekundu", "l.sanch.pet"),
      LINK.replace(/a$/, "za-sekundu"),
    )
    assert.strictEqual(stubUrl("https://sanch.pet/ru/", "l.sanch.pet"), "https://l.sanch.pet/ru/")
    assert.strictEqual(
      stubUrl("https://sanch.pet/ru/posts/%D0%B0", "l.sanch.pet"),
      "https://l.sanch.pet/ru/posts/%D0%B0",
    )
  })

  test("refuses what is not an https address", () => {
    assert.throws(() => stubUrl("tag:sanch.pet,2026:a", "l.sanch.pet"))
    assert.throws(() => stubUrl("not a url", "l.sanch.pet"))
  })

  test("the configured host is the one the build lays the stubs out for", () => {
    const config = loadConfig(new URL("./config.json", import.meta.url).pathname)
    const plugin = fs.readFileSync(
      new URL("../../local-plugins/share.tsx", import.meta.url),
      "utf8",
    )
    assert.ok(plugin.includes(`export const SHARE_HOST = "${config.shareHost}"`))
  })
})

describe("buildText", () => {
  test("title, summary and link", () => {
    assert.strictEqual(
      buildText({ ...entry, title: "За секунду", summary: "Что может успеть произойти?" }, LINK),
      `<b>За секунду</b>\n\nЧто может успеть произойти?\n\n${LINK}`,
    )
  })

  test("without a summary the title stands alone", () => {
    assert.strictEqual(buildText(entry, LINK), `<b>A</b>\n\n${LINK}`)
    assert.strictEqual(buildText({ ...entry, summary: " A " }, LINK), `<b>A</b>\n\n${LINK}`)
  })

  test("escapes what HTML parse mode would read as markup", () => {
    const text = buildText(
      { ...entry, title: "a < b & c", summary: "<b>x</b> &amp;" },
      LINK + "?a=1&b=2",
    )
    assert.strictEqual(
      text,
      `<b>a &lt; b &amp; c</b>\n\n&lt;b&gt;x&lt;/b&gt; &amp;amp;\n\n${LINK}?a=1&amp;b=2`,
    )
    assert.strictEqual(escapeHtml(`"quotes" stay`), `"quotes" stay`)
  })

  test("a summary too long for one message is cut", () => {
    const text = buildText({ ...entry, summary: "я".repeat(5000) }, LINK)
    assert.strictEqual(text.replace(/<\/?b>/g, "").length, 4096)
    assert.ok(text.endsWith(`…\n\n${LINK}`))
  })
})

describe("messageUrl", () => {
  test("a public channel gives an address, a numeric chat does not", () => {
    assert.strictEqual(messageUrl("@sanchpetblog", 362), "https://t.me/sanchpetblog/362")
    assert.strictEqual(messageUrl("-1001234567890", 362), undefined)
  })
})
