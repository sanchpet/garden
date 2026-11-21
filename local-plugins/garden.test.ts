import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { BuildCtx } from "../quartz/util/ctx"
import { PRIVATE_LINK_MARK, publishedPages, publishedSlugs } from "./garden"
import { relinked } from "./languages"
import { FEED_PROBLEM_MARK } from "./feed"
import { CONTENT_PROBLEM_MARK } from "./sources"
import { REJECTED } from "./frontmatter.fixtures"

describe("what will exist on the site", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "garden-published-"))
  const notes: Record<string, string> = {
    "ru/plain.md": "---\ntype: post\n---\n",
    "ru/no-frontmatter.md": "Body only\n",
    "ru/not-draft.md": "---\ndraft: false\n---\n",
    "ru/draft-yes.md": "---\ndraft: yes\n---\n",
    "ru/broken.md": "---\nkey: [unclosed\ndraft: true\n---\n",
    "ru/broken-not-draft.md": "---\nkey: [unclosed\n---\n",
    "ru/draft-toml.md": "---toml\ndraft = true\n---\n",
    "ru/draft-after-newline.md": "\n---\ndraft: true\n---\n",
    "ru/draft-after-space.md": " ---\ndraft: true\n---\n",
    "ru/draft-after-nbsp.md": "\u00a0---\ndraft: true\n---\n",
    "ru/draft-after-crlf.md": "\r\n---\r\ndraft: true\r\n---\r\n",
    "ru/draft-after-bom-newline.md": "\ufeff\n---\ndraft: true\n---\n",
    ...Object.fromEntries(
      REJECTED.map((block, i) => [
        `ru/draft-rejected-${i}.md`,
        `---\ndraft: true\n${block}\n---\n`,
      ]),
    ),
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
      "ru/draft-yes",
      "ru/no-frontmatter",
      "ru/not-draft",
      "ru/plain",
    ])
  })

  test("the published notes come with their frontmatter, files without", () => {
    const pages = publishedPages(ctx)
    assert.deepStrictEqual(pages.get("ru/plain"), { type: "post" })
    assert.deepStrictEqual(pages.get("ru/no-frontmatter"), {})
    assert.ok(!pages.has("media/cover.jpg") && !pages.has("ru/draft"))
  })

  test("a note whose frontmatter cannot be read is unpublished, draft or not", () => {
    const slugs = publishedSlugs(ctx)
    assert.ok(!slugs.has("ru/broken") && !slugs.has("ru/broken-not-draft"))
    assert.strictEqual(REJECTED.length, 7)
    REJECTED.forEach((_, i) => assert.ok(!slugs.has(`ru/draft-rejected-${i}`), String(i)))
  })

  test("a rebuild with a new file list is read anew", () => {
    const rebuilt = { ...ctx, allFiles: ["ru/plain.md", "ru/draft.md"] } as BuildCtx
    assert.deepStrictEqual([...publishedSlugs(rebuilt)], ["ru/plain"])
    const same = { argv: ctx.argv, allFiles: ["ru/plain.md"] } as unknown as BuildCtx
    assert.deepStrictEqual([...publishedSlugs(same)], ["ru/plain"])
    same.allFiles = ["ru/plain.md", "ru/not-draft.md"] as BuildCtx["allFiles"]
    assert.deepStrictEqual([...publishedSlugs(same)], ["ru/plain", "ru/not-draft"])
    assert.deepStrictEqual([...publishedPages(same).keys()], ["ru/plain", "ru/not-draft"])
  })
})

describe("links after a move to the reader's language", () => {
  test("the moved link is renamed and a page is listed once", () => {
    assert.deepStrictEqual(relinked(["a", "x", "b"], "x", "y"), ["a", "y", "b"])
    assert.deepStrictEqual(relinked(["ru/x", "x", "b"], "x", "ru/x"), ["ru/x", "b"])
    assert.strictEqual(relinked(undefined, "x", "y"), undefined)
  })
})

describe("the marks publish.yaml looks for in the build log", () => {
  const workflow = fs.readFileSync(
    path.join(import.meta.dirname, "..", ".github", "workflows", "publish.yaml"),
    "utf8",
  )

  test("each mark is listed in the summary and raised as a warning", () => {
    for (const mark of [PRIVATE_LINK_MARK, FEED_PROBLEM_MARK, CONTENT_PROBLEM_MARK]) {
      assert.strictEqual(workflow.split(`grep '${mark}' build.log`).length - 1, 2, mark)
    }
  })
})
