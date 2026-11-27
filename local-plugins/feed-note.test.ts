import test, { describe } from "node:test"
import assert from "node:assert"
import { DEFAULT_FEED_NOTE, feedNote, noteXhtml } from "./feed-note"

describe("feed note", () => {
  test("paragraphs, a link, emphasis and inline code become XHTML", () => {
    assert.strictEqual(
      noteXhtml("Скопируйте `адрес` в [читалку](https://netnewswire.com/), **вот**.\n\nИ *всё*."),
      '<h:p>Скопируйте <h:code>адрес</h:code> в <h:a href="https://netnewswire.com/">читалку</h:a>, <h:strong>вот</h:strong>.</h:p><h:p>И <h:em>всё</h:em>.</h:p>',
    )
  })

  test("raw HTML is dropped and an unsafe link keeps only its text", () => {
    assert.strictEqual(
      noteXhtml("Текст <script>alert(1)</script> и [ссылка](javascript:alert(1)) & <b>жир</b>"),
      "<h:p>Текст  и ссылка &amp; жир</h:p>",
    )
  })

  test("a missing or empty field falls back to the default", () => {
    const fallback = noteXhtml(DEFAULT_FEED_NOTE.ru)
    assert.ok(fallback.startsWith("<h:p>Это лента для RSS-читалки."))
    assert.strictEqual(feedNote(undefined, "ru"), fallback)
    assert.strictEqual(feedNote("  \n", "ru"), fallback)
    assert.strictEqual(feedNote(42, "ru"), fallback)
    assert.strictEqual(feedNote("Своё.", "ru"), "<h:p>Своё.</h:p>")
  })
})
