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
put("ru/site/feed.md", "Первый абзац с [ссылкой](https://example.org/).\n\nВторой абзац.\n")
put("en/site/feed.md", "---\naliases: [Feed note]\n---\n\nThe body only.\n")
put("ru/site/language.md", "  \n")

describe("site texts", () => {
  test("a file's body is the text, its frontmatter is not", () => {
    assert.strictEqual(
      siteText(content, "ru", "feed"),
      "Первый абзац с [ссылкой](https://example.org/).\n\nВторой абзац.",
    )
    assert.strictEqual(siteText(content, "en", "feed"), "The body only.")
  })

  test("a missing or empty file says nothing", () => {
    assert.strictEqual(siteText(content, "en", "language"), undefined)
    assert.strictEqual(siteText(content, "ru", "language"), undefined)
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
    const files = ["ru/site/feed.md", "en/site/language.md", "ru/site.md", "ru/posts/site/x.md"]
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      fs.writeFileSync(path.join(dir, file), "")
    }
    const built = (await globby("**/*.*", { cwd: dir, ignore })).sort()
    assert.deepStrictEqual(built, ["ru/posts/site/x.md", "ru/site.md"])
    // The watcher of `quartz build --serve` matches the same patterns with minimatch.
    const watched = files.filter((file) => !ignore.some((pattern) => minimatch(file, pattern)))
    assert.deepStrictEqual(watched.sort(), ["ru/posts/site/x.md", "ru/site.md"])
  })
})
