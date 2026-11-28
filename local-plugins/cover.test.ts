import assert from "node:assert"
import test, { describe } from "node:test"
import { h } from "preact"
import { render } from "preact-render-to-string"
import type { QuartzComponentProps } from "../quartz/components/types"
import { coverCopyPath, coverImage, coverOf, copySize, NoteCover } from "./cover"
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

  // The CSS sizes the box from this ratio, so the title beside the cover wraps before it loads.
  test("the page's cover carries its ratio, a cover without a size none", () => {
    const Cover = NoteCover()
    const page = (fileData: object) =>
      render(h(Cover, { fileData } as unknown as QuartzComponentProps))
    const sized = page({
      slug: "ru/posts/a",
      cover: "media/a.jpg",
      coverCopy: { path: "static/covers/media/a.webp", width: 640, height: 800 },
    })
    assert.match(sized, /style="--cover-ratio: 0\.8"/)
    assert.doesNotMatch(page({ slug: "ru/posts/a", cover: "media/a.jpg" }), /--cover-ratio/)
  })
})
