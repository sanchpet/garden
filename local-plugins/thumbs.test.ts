import assert from "node:assert"
import test, { describe } from "node:test"
import { pictureSlug, pictures, thumbPath } from "./thumbs"

describe("thumbnails", () => {
  test("a picture's slug is resolved against the page that shows it", () => {
    assert.strictEqual(
      pictureSlug("../../media/pasted-image-1.png", "ru/notes/2026-11-22-1840"),
      "media/pasted-image-1.png",
    )
    assert.strictEqual(
      pictureSlug("../ru/notes/n/../../../media/a%20b.jpg", "ru/stream"),
      "media/a b.jpg",
    )
  })

  test("an address outside the texts is no picture of theirs", () => {
    for (const src of [
      "https://example.com/a.jpg",
      "/static/logo.png",
      "data:image/png;base64,x",
      "../../../a.jpg",
    ])
      assert.strictEqual(pictureSlug(src, "ru/notes/n"), null)
  })

  test("the copy is a JPEG under static/thumbs, whatever the source format", () => {
    assert.strictEqual(
      thumbPath("media/pasted-image-1.png"),
      "static/thumbs/media/pasted-image-1.jpg",
    )
  })

  test("pictures are found in document order", () => {
    const img = (src: string) => ({
      type: "element" as const,
      tagName: "img",
      properties: { src },
      children: [],
    })
    const tree = {
      type: "root" as const,
      children: [
        { type: "element" as const, tagName: "p", properties: {}, children: [img("a.jpg")] },
        img("b.png"),
      ],
    }
    assert.deepStrictEqual(pictures(tree), ["a.jpg", "b.png"])
  })
})
