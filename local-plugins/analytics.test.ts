import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { counterUrl, viewsLine } from "./analytics"

describe("counterUrl", () => {
  it("encodes the whole path as one component", () => {
    assert.equal(
      counterUrl("/ru/posts/billionaire-math"),
      "https://stats.sanch.pet/counter/%2Fru%2Fposts%2Fbillionaire-math.json",
    )
  })
})

describe("viewsLine", () => {
  it("declines the Russian word by number", () => {
    assert.equal(viewsLine("1", "ru"), "1 просмотр")
    assert.equal(viewsLine("3", "ru"), "3 просмотра")
    assert.equal(viewsLine("11", "ru"), "11 просмотров")
    assert.equal(viewsLine("21", "ru"), "21 просмотр")
  })
  it("uses singular and plural in English", () => {
    assert.equal(viewsLine("1", "en"), "1 view")
    assert.equal(viewsLine("2", "en"), "2 views")
  })
  it("reads GoatCounter's grouped numbers", () => {
    assert.equal(viewsLine("1 234", "en"), "1,234 views")
  })
  it("says nothing for zero, garbage or nothing", () => {
    assert.equal(viewsLine("0", "ru"), undefined)
    assert.equal(viewsLine("", "ru"), undefined)
    assert.equal(viewsLine(undefined, "en"), undefined)
  })
})
