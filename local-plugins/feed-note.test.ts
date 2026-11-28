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

  test("an Obsidian callout becomes a titled block", () => {
    assert.strictEqual(
      noteXhtml(
        "Текст.\n\n> [!note] Как подписаться\n> Выполните `/feed subscribe`.\n>\n> Второй абзац.",
      ),
      '<h:p>Текст.</h:p><h:div class="callout"><h:p class="callout-title">Как подписаться</h:p><h:p>Выполните <h:code>/feed subscribe</h:code>.</h:p><h:p>Второй абзац.</h:p></h:div>',
    )
    assert.strictEqual(
      noteXhtml("> [!tip]\n> Без заголовка."),
      '<h:div class="callout"><h:p class="callout-title">tip</h:p><h:p>Без заголовка.</h:p></h:div>',
    )
    assert.strictEqual(noteXhtml("> Просто цитата."), "<h:p>Просто цитата.</h:p>")
  })

  test("a missing or empty site text falls back to the default", () => {
    const fallback = noteXhtml(DEFAULT_FEED_NOTE.ru)
    assert.ok(fallback.startsWith("<h:p>Это лента для RSS-читалки."))
    assert.strictEqual(feedNote(undefined, "ru"), fallback)
    assert.strictEqual(feedNote("  \n", "ru"), fallback)
    assert.strictEqual(feedNote("Своё.", "ru"), "<h:p>Своё.</h:p>")
  })
})
