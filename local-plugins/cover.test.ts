import assert from "node:assert"
import test, { describe } from "node:test"
import { coverCopyPath, coverImage, coverOf, copySize } from "./cover"
import { thumbPath } from "./thumbs"

describe("cover copies", () => {
  test("a wide cover is narrowed to 640 px, keeping its proportions", () => {
    assert.deepStrictEqual(copySize({ width: 1024, height: 1280 }), { width: 640, height: 800 })
  })

  test("a cover narrower than 640 px is never enlarged", () => {
    assert.deepStrictEqual(copySize({ width: 300, height: 449 }), { width: 300, height: 449 })
  })

  test("a cover turned by EXIF is sized upright", () => {
    assert.deepStrictEqual(copySize({ width: 4000, height: 3000, orientation: 6 }), {
      width: 640,
      height: 853,
    })
  })

  test("the copy is a WebP under static/covers, apart from the stream's thumbnails", () => {
    assert.strictEqual(
      coverCopyPath("media/thaler-misbehaving.jpg"),
      "static/covers/media/thaler-misbehaving.webp",
    )
    assert.notStrictEqual(coverCopyPath("media/a.png"), thumbPath("media/a.png"))
  })

  test("the page loads the copy while the link preview keeps the original", () => {
    const data = {
      cover: "media/billionaire-math-cover.jpg",
      coverCopy: {
        path: "static/covers/media/billionaire-math-cover.webp",
        width: 640,
        height: 800,
      },
    }
    assert.deepStrictEqual(coverImage(data), {
      src: "static/covers/media/billionaire-math-cover.webp",
      width: 640,
      height: 800,
    })
    assert.strictEqual(coverOf(data), "media/billionaire-math-cover.jpg")
  })

  test("a cover without a copy is shown as it is, and a page without one shows none", () => {
    assert.deepStrictEqual(coverImage({ cover: "media/a.jpg" }), { src: "media/a.jpg" })
    assert.strictEqual(coverImage({}), undefined)
  })
})
