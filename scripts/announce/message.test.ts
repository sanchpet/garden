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
  test("the author's announcement is the message, without the title", () => {
    assert.strictEqual(
      buildText(
        { ...entry, title: "За секунду", content: " Что может успеть произойти?\nМного. " },
        LINK,
      ),
      `Что может успеть произойти?\nМного.\n\n${LINK}`,
    )
  })

  test("without an announcement: the title in bold and the link, the description left out", () => {
    assert.strictEqual(buildText(entry, LINK), `<b>A</b>\n\n${LINK}`)
    assert.strictEqual(
      buildText({ ...entry, summary: "Description", content: "  " }, LINK),
      `<b>A</b>\n\n${LINK}`,
    )
  })

  test("escapes what HTML parse mode would read as markup", () => {
    assert.strictEqual(
      buildText({ ...entry, content: "<b>x</b> &amp; y" }, LINK + "?a=1&b=2"),
      `&lt;b&gt;x&lt;/b&gt; &amp;amp; y\n\n${LINK}?a=1&amp;b=2`,
    )
    assert.strictEqual(
      buildText({ ...entry, title: "a < b & c" }, LINK),
      `<b>a &lt; b &amp; c</b>\n\n${LINK}`,
    )
    assert.strictEqual(escapeHtml(`"quotes" stay`), `"quotes" stay`)
  })

  test("an announcement too long for one message is cut", () => {
    const text = buildText({ ...entry, content: "я".repeat(5000) }, LINK)
    assert.strictEqual(text.length, 4096)
    assert.ok(text.endsWith(`…\n\n${LINK}`))
  })
})

describe("messageUrl", () => {
  test("the address of a post in a public channel", () => {
    assert.strictEqual(messageUrl("@sanchpetblog", 362), "https://t.me/sanchpetblog/362")
  })
})
