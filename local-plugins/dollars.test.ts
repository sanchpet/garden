import assert from "node:assert"
import test, { describe } from "node:test"
import { escapeLoneDollars, escapeParagraph } from "./dollars"

describe("lone dollars", () => {
  test("prices are not a formula", () => {
    assert.strictEqual(
      escapeParagraph("выиграть 100$ ощущается легче, чем потеря 100$, которые вынули"),
      "выиграть 100\\$ ощущается легче, чем потеря 100\\$, которые вынули",
    )
    assert.strictEqual(
      escapeParagraph("стоит 100 $, и нам он достался, как трата 100 $, ведь"),
      "стоит 100 \\$, и нам он достался, как трата 100 \\$, ведь",
    )
    assert.strictEqual(escapeParagraph("стоит $100 и $200"), "стоит \\$100 и \\$200")
  })

  test("a formula Obsidian renders stays one", () => {
    for (const text of ["площадь $\\pi r^2$ круга", "$x$ и $y$", "если $a < b$, то"])
      assert.strictEqual(escapeParagraph(text), text)
  })

  test("an escaped dollar, code and display math are left alone", () => {
    for (const text of ["уже \\$5", "команда `echo $HOME` и `$PATH`", "формула $$a$$ внутри"])
      assert.strictEqual(escapeParagraph(text), text)
  })

  test("frontmatter, fenced code and a display block are not touched", () => {
    const src = [
      "---",
      'title: "100$"',
      "---",
      "",
      "```sh",
      "echo $HOME 100$",
      "```",
      "",
      "$$",
      "x = 5$",
      "$$",
      "",
      "Цена 100$ за",
      "два билета.",
    ].join("\n")
    assert.strictEqual(escapeLoneDollars(src), src.replace("Цена 100$", "Цена 100\\$"))
  })

  test("a formula may run over a line break inside its paragraph", () => {
    const src = "Пусть $a +\nb$ равно."
    assert.strictEqual(escapeLoneDollars(src), src)
  })
})
