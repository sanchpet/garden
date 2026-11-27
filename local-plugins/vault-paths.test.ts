import assert from "node:assert"
import { describe, test } from "node:test"
import { fromVaultRoot } from "./vault-paths"

describe("fromVaultRoot", () => {
  test("a link and an embed from the vault root lose the vault folder", () => {
    assert.strictEqual(
      fromVaultRoot("shelf of [[50-garden/ru/library/index|books]] and ![[50-garden/media/a.png]]"),
      "shelf of [[ru/library/index|books]] and ![[media/a.png]]",
    )
  })

  test("other links and plain mentions of the folder stay", () => {
    const src = "[[the-glass|glass]], see 50-garden/ru and [[ru/colophon]]"
    assert.strictEqual(fromVaultRoot(src), src)
  })

  test("code shows the link as written", () => {
    const src = [
      "`[[50-garden/ru/x]]` inline",
      "~~~markdown",
      "[[50-garden/ru/x]]",
      "~~~",
      "[[50-garden/ru/y]]",
    ].join("\n")
    assert.strictEqual(
      fromVaultRoot(src),
      ["`[[50-garden/ru/x]]` inline", "~~~markdown", "[[50-garden/ru/x]]", "~~~", "[[ru/y]]"].join(
        "\n",
      ),
    )
  })
})
