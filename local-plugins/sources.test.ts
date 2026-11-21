import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { h } from "preact"
import { render } from "preact-render-to-string"
import type { QuartzComponent, QuartzComponentProps } from "../quartz/components/types"
import type { BuildCtx } from "../quartz/util/ctx"
import { FrontmatterLinks, SourceList, withoutSourceTexts } from "./sources"

const file = (slug: string, frontmatter: Record<string, unknown>, links: string[] = []) => ({
  slug,
  frontmatter,
  links,
})
const card = file("ru/library/misbehaving", {
  type: "book",
  title: "Mis<behaving> & co",
  author: "Ричард Талер",
  year: 2015,
})
const text = file(
  "ru/posts/a",
  {
    type: "post",
    title: 'A "quoted" <title>',
    created: "2026-11-20",
    sources: ["[[misbehaving]]", "A <b>paper</b> & co", "[[gone|<i>Gone</i>]]"],
  },
  ["ru/library/misbehaving"],
)
const twin = file("en/posts/a", { type: "post", title: "A in English", created: "2026-11-21" }, [
  "ru/library/misbehaving",
])
const mention = file("ru/posts/mention", { type: "post", title: "Mention" }, [
  "ru/library/misbehaving",
])
const allFiles = [card, text, twin, mention]

function html(component: QuartzComponent, slug: string, files = allFiles): string {
  const fileData = files.find((f) => f.slug === slug)
  return render(h(component, { fileData, allFiles: files } as unknown as QuartzComponentProps))
}

describe("the bibliography under a text", () => {
  const List = SourceList()

  test("a card is linked by its title, between author and year", () => {
    assert.match(
      html(List, "ru/posts/a"),
      /<h2>Источники<\/h2><ol><li>Ричард Талер\. <a class="internal" href="\.\.\/\.\.\/ru\/library\/misbehaving">Mis&lt;behaving> &amp; co<\/a>\. 2015<\/li>/,
    )
  })

  test("a plain string and a label are text, never markup, and carry no link", () => {
    const out = html(List, "ru/posts/a")
    assert.ok(out.includes("<li>A &lt;b>paper&lt;/b> &amp; co</li><li>&lt;i>Gone&lt;/i></li>"))
    assert.ok(!/<b>|<i>|<behaving>/.test(out))
    assert.strictEqual(out.match(/<a /g)?.length, 1)
  })

  test("the translation shows the inherited list under an English heading", () => {
    const out = html(List, "en/posts/a")
    assert.match(out, /<h2>Sources<\/h2>/)
    assert.match(out, /href="\.\.\/\.\.\/ru\/library\/misbehaving"/)
  })

  test("no section on a page without sources or on a card nobody names", () => {
    assert.strictEqual(html(List, "ru/posts/mention"), "")
    assert.strictEqual(html(List, "ru/library/misbehaving", [card, mention]), "")
  })
})

describe("the texts under a source card", () => {
  const List = SourceList()

  test("one entry per translation pair with kind and date, the title escaped", () => {
    const out = html(List, "ru/library/misbehaving")
    assert.match(out, /<h2>Тексты по источнику<\/h2>/)
    assert.ok(
      out.includes(
        '<a class="internal" href="../../ru/posts/a">A &quot;quoted&quot; &lt;title></a>',
      ),
    )
    assert.ok(out.includes('пост · <time datetime="2026-11-20T00:00:00Z">20 нояб. 2026'))
    assert.strictEqual(out.match(/<li>/g)?.length, 1)
  })
})

describe("the stock backlinks next to the typed section", () => {
  const Stock: QuartzComponent = ({ fileData, allFiles }) =>
    h(
      "ul",
      {},
      allFiles.filter((f) => f.links?.includes(fileData.slug as never)).map((f) => f.slug),
    )
  Stock.css = ".stock {}"
  const Backlinks = withoutSourceTexts(Stock)

  test("a text listed under the card, in either language, is not repeated there", () => {
    assert.strictEqual(html(Backlinks, "ru/library/misbehaving"), "<ul>ru/posts/mention</ul>")
    assert.strictEqual(
      html(Stock, "ru/library/misbehaving"),
      "<ul>ru/posts/aen/posts/aru/posts/mention</ul>",
    )
  })

  test("other pages keep their backlinks, and the block keeps its resources", () => {
    const linked = [...allFiles, file("ru/posts/b", { type: "post" }, ["ru/posts/a"])]
    assert.strictEqual(html(Backlinks, "ru/posts/a", linked), "<ul>ru/posts/b</ul>")
    assert.strictEqual(Backlinks.css, ".stock {}")
  })
})

describe("frontmatter links on their way to the content index", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "garden-sources-"))
  const write = (fp: string, frontmatter: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, fp)), { recursive: true })
    fs.writeFileSync(path.join(dir, fp), `---\n${frontmatter}\n---\n\nBody.\n`)
  }
  write("ru/library/misbehaving.md", "type: book\naliases:\n  - Misbehaving")
  write("ru/library/draft-card.md", "type: book\ndraft: true")
  write("ru/posts/other.md", "type: post")
  write("en/posts/a.md", "type: post")
  write(
    "ru/posts/a.md",
    'type: post\nsources:\n  - "[[misbehaving]]"\n  - "[[draft-card|Draft]]"\n  - "[[other|No source]]"\n  - "[[d-999-private|Private]]"',
  )
  fs.writeFileSync(path.join(dir, "cover.jpg"), "")
  const ctx = {
    argv: { directory: dir },
    allFiles: [
      "ru/library/misbehaving.md",
      "ru/library/draft-card.md",
      "ru/posts/other.md",
      "ru/posts/a.md",
      "en/posts/a.md",
      "cover.jpg",
    ],
  } as unknown as BuildCtx
  const [plugin] = FrontmatterLinks().markdownPlugins!(ctx) as [() => Function]
  const linksOf = (slug: string, frontmatter: Record<string, unknown>) => {
    const vfile = { data: { slug, frontmatter, frontmatterLinks: ["stock", "d-034-private"] } }
    plugin()(undefined, vfile)
    return vfile.data.frontmatterLinks
  }
  test.after(() => fs.rmSync(dir, { recursive: true }))

  test("a link to a private draft or to a garden draft is dropped, a site file is kept", () => {
    assert.deepStrictEqual(
      linksOf("ru/evergreen/x", {
        drafts: ["[[d-034-private]]", "[[draft-card]]"],
        cover: "[[cover.jpg]]",
        related: "[[other]]",
      }),
      ["cover.jpg", "ru/posts/other"],
    )
    assert.deepStrictEqual(linksOf("ru/evergreen/x", { title: "No links" }), [])
  })

  test("sources give the published source cards only, whatever else they name", () => {
    const sources = [
      "[[misbehaving]]",
      "[[draft-card|Draft]]",
      "[[other|No source]]",
      "[[d-999-private|P]]",
    ]
    assert.deepStrictEqual(linksOf("ru/posts/a", { type: "post", sources }), [
      "ru/library/misbehaving",
    ])
  })

  test("a translation without its own list gets the cards of its twin", () => {
    assert.deepStrictEqual(linksOf("en/posts/a", { type: "post" }), ["ru/library/misbehaving"])
  })
})
