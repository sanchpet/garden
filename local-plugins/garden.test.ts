import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { BuildCtx } from "../quartz/util/ctx"
import { publishedPages, publishedSlugs } from "./garden"

describe("what will exist on the site", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "garden-published-"))
  const notes: Record<string, string> = {
    "ru/plain.md": "---\ntype: post\n---\n",
    "ru/no-frontmatter.md": "Body only\n",
    "ru/not-draft.md": "---\ndraft: false\n---\n",
    "ru/draft-yes.md": "---\ndraft: yes\n---\n",
    "ru/broken.md": "---\nkey: [unclosed\ndraft: true\n---\n",
    "ru/body-says-draft.md": "---\n---\ndraft: true\n\n---\n",
    "ru/draft.md": "---\ndraft: true\n---\n",
    "ru/draft-quoted.md": "---\ndraft: 'true'\n---\n",
    "ru/draft-upper.md": "---\ndraft: True\n---\n",
    "ru/draft-comment.md": "---\ndraft: true # not yet\n---\n",
    "ru/draft-bom.md": "﻿---\ndraft: true\n---\n",
    "ru/draft-long.md": `---\nnote: ${"x".repeat(5000)}\ndraft: true\n---\n`,
    "media/cover.jpg": "",
  }
  for (const [fp, text] of Object.entries(notes)) {
    fs.mkdirSync(path.dirname(path.join(dir, fp)), { recursive: true })
    fs.writeFileSync(path.join(dir, fp), text)
  }
  const ctx = { argv: { directory: dir }, allFiles: Object.keys(notes) } as unknown as BuildCtx
  test.after(() => fs.rmSync(dir, { recursive: true }))

  test("every spelling of a draft the stock filter drops is unpublished here too", () => {
    assert.deepStrictEqual([...publishedSlugs(ctx)].sort(), [
      "media/cover.jpg",
      "ru/body-says-draft",
      "ru/broken",
      "ru/draft-yes",
      "ru/no-frontmatter",
      "ru/not-draft",
      "ru/plain",
    ])
  })

  test("the published notes come with their frontmatter, files without", () => {
    const pages = publishedPages(ctx)
    assert.deepStrictEqual(pages.get("ru/plain"), { type: "post" })
    assert.deepStrictEqual(pages.get("ru/broken"), {})
    assert.ok(!pages.has("media/cover.jpg") && !pages.has("ru/draft"))
  })
})
