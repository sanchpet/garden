import assert from "node:assert"
import test, { describe } from "node:test"
import { drawCard, type Card } from "./draw"
import { fit, widthOf, wrap } from "./type"

const base = { mark: "data:image/png;base64,AA==", label: "пост", title: "За секунду" }

describe("card text", () => {
  test("a line never runs wider than the column", () => {
    const text = "Как я полгода переносил домашнюю лабораторию на один зарубежный кластер"
    for (const line of wrap(text, "title", 56, 1040, 3))
      assert.ok(widthOf(line, "title", 56) <= 1040, line)
  })

  test("what does not fit is cut at a word and ends with an ellipsis", () => {
    const lines = wrap(
      "один два три четыре пять шесть семь восемь девять десять",
      "text",
      40,
      200,
      2,
    )
    assert.strictEqual(lines.length, 2)
    assert.match(lines[1], /[а-я]…$/)
  })

  test("a short title takes the largest size, a long word a smaller one", () => {
    assert.strictEqual(fit("K3s", "hand", [46, 40, 34], 220, 6).size, 46)
    assert.ok(fit("Распределённые", "hand", [46, 40, 34, 28], 220, 6).size < 46)
  })
})

describe("drawCard", () => {
  const cards: Card[] = [
    { ...base, kind: "text", description: "Аннотация", foot: "15 ноября 2026" },
    { ...base, kind: "source", path: "library/a", author: "Автор, 2020" },
    { ...base, kind: "tool", path: "engineering/radar/a", ring: 2 },
  ]

  test("every kind is a 1200×630 drawing with no text left for the rasteriser to set", () => {
    for (const card of cards) {
      const svg = drawCard(card)
      assert.match(svg, /^<svg [^>]*width="1200" height="630"/)
      assert.ok(!svg.includes("<text"), card.kind)
    }
  })

  test("the same page draws the same card on every build", () => {
    for (const card of cards) assert.strictEqual(drawCard(card), drawCard(card))
  })

  test("a title with markup characters does not break the drawing", () => {
    const svg = drawCard({ ...base, kind: "text", title: `A < B & "C"` })
    assert.ok(svg.includes("<title>A &lt; B &amp; &quot;C&quot;</title>"))
  })
})
