import assert from "node:assert"
import test, { describe } from "node:test"
import { buildText, escapeHtml, messageUrl, pageUrl } from "./message"

const entry = { id: "https://sanch.pet/ru/posts/a", title: "A", categories: [], related: [] }
const LINK = "https://sanch.pet/ru/posts/a"

describe("pageUrl", () => {
  test("is the page's own address", () => {
    assert.strictEqual(
      pageUrl("https://sanch.pet/ru/posts/%D0%B0"),
      "https://sanch.pet/ru/posts/%D0%B0",
    )
    assert.strictEqual(pageUrl("https://sanch.pet/ru/"), "https://sanch.pet/ru/")
  })

  test("names the channel for the site's analytics", () => {
    assert.strictEqual(
      pageUrl("https://sanch.pet/ru/posts/a", "sanchpetblog"),
      "https://sanch.pet/ru/posts/a?src=tgsanchpetblog",
    )
  })

  test("refuses what is not an https address", () => {
    assert.throws(() => pageUrl("tag:sanch.pet,2026:a"))
    assert.throws(() => pageUrl("not a url"))
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

describe("a note", () => {
  const note = {
    ...entry,
    id: "https://sanch.pet/ru/notes/2026-11-21-0910",
    kind: "note",
    content: "Туман <такой>, что города не видно.",
  }

  test("is posted whole, with the way to its page as a phrase and no bare address", () => {
    assert.strictEqual(
      buildText(note, `${note.id}?src=tgsanchpetblog`),
      'Туман &lt;такой&gt;, что города не видно.\n\n<a href="https://sanch.pet/ru/notes/2026-11-21-0910?src=tgsanchpetblog">Прочесть заметку на сайте</a>',
    )
  })

  test("an English note is signed in English", () => {
    assert.match(
      buildText({ ...note, id: "https://sanch.pet/en/notes/n" }, "https://sanch.pet/en/notes/n"),
      /<a href="https:\/\/sanch\.pet\/en\/notes\/n">Read the note on the site<\/a>$/,
    )
  })

  test("a long note is cut to fit with its closing phrase", () => {
    const text = buildText({ ...note, content: "я".repeat(5000) }, LINK)
    const visible = text.replace(/<[^>]+>/g, "")
    assert.ok(visible.length <= 4096)
    assert.match(text, /…\n\n<a href=/)
  })
})

describe("messageUrl", () => {
  test("the address of a post in a public channel", () => {
    assert.strictEqual(messageUrl("@sanchpetblog", 362), "https://t.me/sanchpetblog/362")
  })
})
