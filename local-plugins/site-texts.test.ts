import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "fs"
import os from "os"
import path from "path"
import { globby } from "globby"
import { minimatch } from "minimatch"
import { parse } from "yaml"
import { plainText, siteText } from "./site-texts"

const content = fs.mkdtempSync(path.join(os.tmpdir(), "site-texts-"))
const put = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(content, file)), { recursive: true })
  fs.writeFileSync(path.join(content, file), text)
}
put(
  "ru/site.md",
  [
    "Вступление до первого раздела не текст.",
    "",
    "## Feed ",
    "",
    "Первый абзац с [ссылкой](https://example.org/).",
    "",
    "```md",
    "## language",
    "```",
    "",
    "Второй абзац.",
    "",
    "## language",
    "",
    "  ",
  ].join("\n"),
)
put("en/site.md", "---\naliases: [Site]\nfeed: not this\n---\n\n## feed\n\nThe body only.\n")

describe("site texts", () => {
  test("each ## section of the file is a text, its key matched loosely", () => {
    assert.strictEqual(
      siteText(content, "ru", "feed"),
      "Первый абзац с [ссылкой](https://example.org/).\n\n```md\n## language\n```\n\nВторой абзац.",
    )
    assert.strictEqual(siteText(content, "en", "feed"), "The body only.")
  })

  test("a missing file, a missing section or an empty one says nothing", () => {
    assert.strictEqual(siteText(content, "en", "language"), undefined)
    assert.strictEqual(siteText(content, "ru", "language"), undefined)
    assert.strictEqual(siteText(path.join(content, "nowhere"), "ru", "feed"), undefined)
  })

  test("the language note keeps only the words of its Markdown", () => {
    assert.strictEqual(
      plainText("Сайт **двуязычный**, [подробнее](https://example.org/).\n\nВторой `абзац`."),
      "Сайт двуязычный, подробнее. Второй абзац.",
    )
    assert.strictEqual(plainText("Просто текст."), "Просто текст.")
  })

  test("the build skips the site texts and nothing else", async () => {
    const config = parse(fs.readFileSync("quartz.config.yaml", "utf8"))
    const ignore: string[] = config.configuration.ignorePatterns
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-glob-"))
    const files = ["ru/site.md", "en/site.md", "ru/site/x.md", "ru/posts/site.md", "en/sites.md"]
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      fs.writeFileSync(path.join(dir, file), "")
    }
    const built = (await globby("**/*.*", { cwd: dir, ignore })).sort()
    assert.deepStrictEqual(built, ["en/sites.md", "ru/posts/site.md", "ru/site/x.md"])
    // The watcher of `quartz build --serve` matches the same patterns with minimatch.
    const watched = files.filter((file) => !ignore.some((pattern) => minimatch(file, pattern)))
    assert.deepStrictEqual(watched.sort(), ["en/sites.md", "ru/posts/site.md", "ru/site/x.md"])
  })
})
