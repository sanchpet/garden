import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { BuildCtx } from "../quartz/util/ctx"
import { publishedPages } from "./garden"
import { seriesOf, seriesProblems } from "./series-index"
import { contentProblems } from "./sources-index"

const NAME = "В одиночку или вместе"
const pages = (entries: Record<string, Record<string, unknown>>) => new Map(Object.entries(entries))
const post = (published: string, series: unknown = NAME) => ({ type: "post", published, series })

describe("series", () => {
  const corpus = pages({
    "ru/posts/goals": post("2026-01-11"),
    "ru/posts/mountain": post("2025-11-22"),
    "ru/posts/escapist": { type: "evergreen", created: "2026-01-04", series: ` ${NAME} ` },
    "ru/posts/second": post("2026-11-15"),
    "ru/posts/other": post("2026-02-01", "Другая серия"),
    "ru/posts/plain": { type: "post", published: "2026-03-01" },
    "en/posts/goals": post("2026-01-11"),
    "ru/library/book": { type: "book", series: NAME },
  })

  test("orders members by publication day, the created day standing in for it", () => {
    assert.deepStrictEqual(seriesOf(corpus, "ru/posts/goals"), [
      "ru/posts/mountain",
      "ru/posts/escapist",
      "ru/posts/goals",
      "ru/posts/second",
    ])
  })

  test("is the same list from every member", () => {
    const lists = ["mountain", "escapist", "second"].map((s) => seriesOf(corpus, `ru/posts/${s}`))
    for (const list of lists) assert.deepStrictEqual(list, seriesOf(corpus, "ru/posts/goals"))
  })

  test("keeps languages apart: a lone translation is a series of one, which shows nothing", () => {
    assert.deepStrictEqual(seriesOf(corpus, "en/posts/goals"), [])
    assert.ok(!seriesOf(corpus, "ru/posts/goals").some((slug) => slug.startsWith("en/")))
  })

  test("a single member, a page outside any series and a non-text page show nothing", () => {
    assert.deepStrictEqual(seriesOf(corpus, "ru/posts/other"), [])
    assert.deepStrictEqual(seriesOf(corpus, "ru/posts/plain"), [])
    assert.deepStrictEqual(seriesOf(corpus, "ru/library/book"), [])
    assert.deepStrictEqual(seriesOf(corpus, "ru/posts/missing"), [])
  })

  test("undated members go last, a shared day orders by slug", () => {
    const list = seriesOf(
      pages({
        "ru/b": { type: "post", series: "s" },
        "ru/d": post("2026-01-02", "s"),
        "ru/c": post("2026-01-01", "s"),
        "ru/a": post("2026-01-02", "s"),
      }),
      "ru/a",
    )
    assert.deepStrictEqual(list, ["ru/c", "ru/a", "ru/d", "ru/b"])
  })

  test("leaves drafts out, since only published pages are read", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "garden-series-"))
    const files: Record<string, string> = {
      "ru/one.md": `---\ntype: post\npublished: 2026-01-01\nseries: ${NAME}\n---\n`,
      "ru/two.md": `---\ntype: post\npublished: 2026-01-02\nseries: ${NAME}\n---\n`,
      "ru/draft.md": `---\ntype: post\ndraft: true\npublished: 2026-01-03\nseries: ${NAME}\n---\n`,
    }
    for (const [fp, text] of Object.entries(files)) {
      fs.mkdirSync(path.join(dir, path.dirname(fp)), { recursive: true })
      fs.writeFileSync(path.join(dir, fp), text)
    }
    const ctx = { allFiles: Object.keys(files), argv: { directory: dir } } as unknown as BuildCtx
    assert.deepStrictEqual(seriesOf(publishedPages(ctx), "ru/one"), ["ru/one", "ru/two"])
  })
})

describe("series problems", () => {
  test("a name only one text carries is reported, as a likely typo", () => {
    const problems = seriesProblems(
      pages({ "ru/a": post("2026-01-01"), "ru/b": post("2026-01-02", `${NAME}.`) }),
    )
    assert.deepStrictEqual(problems, [
      `ru/a: series "${NAME}" has no other member`,
      `ru/b: series "${NAME}." has no other member`,
    ])
  })

  test("a value that is not a name, and a series on a page that is not a text, are reported", () => {
    const problems = seriesProblems(
      pages({ "ru/a": post("2026-01-01", ["x"]), "ru/book": { type: "book", series: NAME } }),
    )
    assert.deepStrictEqual(problems, [
      'ru/a: series ["x"] is not a name',
      `ru/book: series "${NAME}" on a page that is not a text`,
    ])
  })

  test("a sound series reports nothing, and the build's content check carries the reports", () => {
    const sound = { "ru/a": post("2026-01-01"), "ru/b": post("2026-01-02") }
    assert.deepStrictEqual(seriesProblems(pages(sound)), [])
    const page = (slug: string, frontmatter: Record<string, unknown>) => ({ slug, frontmatter })
    assert.deepStrictEqual(contentProblems(Object.entries(sound).map(([s, fm]) => page(s, fm))), [])
    assert.deepStrictEqual(contentProblems([page("ru/a", post("2026-01-01"))]), [
      `ru/a: series "${NAME}" has no other member`,
    ])
  })
})
