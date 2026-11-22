import type { ListItem, Root as MdRoot } from "mdast"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzEmitterPlugin, QuartzTransformerPlugin } from "../quartz/plugins/types"
import type { QuartzPluginData } from "../quartz/plugins/vfile"
import type { BuildCtx } from "../quartz/util/ctx"
import { FilePath, FullSlug, resolveRelative, slugifyFilePath } from "../quartz/util/path"
import { publishedPages, publishedSlugs } from "./garden"
import { languageOf } from "./languages"
import {
  buildSources,
  contentProblems,
  linkTargets,
  referenceParts,
  resolveLink,
  textsFor,
  type Page,
  type Sources,
} from "./sources-index"

// publish.yaml greps the build log for this: a `type` outside the registry, a `sources`
// entry that names no published card.
export const CONTENT_PROBLEM_MARK = "garden: content problem"

const UI = {
  ru: {
    locale: "ru-RU",
    sources: "Источники",
    texts: "Тексты по источнику",
    kinds: { post: "пост", evergreen: "вечнозелёная заметка", note: "заметка" } as Record<
      string,
      string
    >,
  },
  en: {
    locale: "en-US",
    sources: "Sources",
    texts: "Texts from this source",
    kinds: { post: "post", evergreen: "evergreen note", note: "note" } as Record<string, string>,
  },
}

// A link target in the form slugs have, as the stock frontmatter parser makes it.
function slugTarget(target: string): string {
  const [file] = target.split("#")
  return slugifyFilePath((file.endsWith(".md") ? file : `${file}.md`) as FilePath)
}

// The relation is needed twice: while a page is parsed, to give it its links, when only the
// files on disk can tell what the other pages are; and when pages are rendered, from their data.
const onDisk = new WeakMap<object, Sources>()
function sourcesOnDisk(ctx: BuildCtx): Sources {
  let sources = onDisk.get(ctx.allFiles)
  if (!sources) {
    const pages = [...publishedPages(ctx)].map(([slug, frontmatter]) => ({ slug, frontmatter }))
    sources = buildSources(pages, slugTarget)
    onDisk.set(ctx.allFiles, sources)
  }
  return sources
}

// A note on the site whose frontmatter publishedPages could not read: links to it are
// stripped, so it takes no part in the relation either.
function unreadable(file: QuartzPluginData, ctx: BuildCtx): boolean {
  return !!file.filePath?.endsWith(".md") && !publishedSlugs(ctx).has(file.slug!)
}

function pagesOf(files: QuartzPluginData[], ctx: BuildCtx): Page[] {
  return files.flatMap((file) =>
    file.slug && !unreadable(file, ctx)
      ? [{ slug: file.slug, frontmatter: (file.frontmatter ?? {}) as Page["frontmatter"] }]
      : [],
  )
}

const rendered = new WeakMap<object, Sources>()
function sourcesOf(allFiles: QuartzPluginData[], ctx: BuildCtx): Sources {
  let sources = rendered.get(allFiles)
  if (!sources) {
    sources = buildSources(pagesOf(allFiles, ctx), slugTarget)
    rendered.set(allFiles, sources)
  }
  return sources
}

// A link in a frontmatter property goes to the content index and the graph without passing
// StripPrivateLinks, which sees the body only. Keep those that lead to a page or a file of
// the site, resolved here; `sources` gives the cards it names.
export const FrontmatterLinks: QuartzTransformerPlugin = () => ({
  name: "FrontmatterLinks",
  markdownPlugins(ctx) {
    const published = publishedSlugs(ctx)
    return [
      () => (_tree, file) => {
        const slug = file.data.slug!
        const lang = languageOf(slug)
        const { sources: _sources, ...properties } = (file.data.frontmatter ??
          {}) as Page["frontmatter"]
        const links = linkTargets(properties).flatMap(
          (target) => resolveLink(slugTarget(target), lang, published) ?? [],
        )
        const cards = sourcesOnDisk(ctx).references.get(slug) ?? []
        // CrawlLinks reads this list; a full slug passes through its resolver unchanged.
        ;(file.data as { frontmatterLinks?: string[] }).frontmatterLinks = [
          ...new Set([...links, ...cards.flatMap((ref) => ref.slug ?? [])]),
        ]
      },
    ]
  },
})

// While pages are parsed a text's title is still where Obsidian keeps it, in `aliases`.
function titleOnDisk(ctx: BuildCtx, slug: string): string | undefined {
  const fm = publishedPages(ctx).get(slug) ?? {}
  const first = [fm.title, fm.aliases].flat().find((v) => typeof v === "string" && v.trim())
  return typeof first === "string" ? first.trim() : undefined
}

const TEXTS_BLOCK = /text-sources["'][^)]*mode:\s*["']texts["']/

const dated = (day: string, locale: string) =>
  new Date(day).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  })

// A source card places its texts itself: where the note has the Obsidian block that lists
// them, the site lists them too, under the note's own heading. A card without the block gets
// the list under the page (SourceList). Must run before ObsidianOnlyBlocks removes the block.
export const SourceTextsInPlace: QuartzTransformerPlugin = () => ({
  name: "SourceTextsInPlace",
  markdownPlugins(ctx) {
    return [
      () => (tree: MdRoot, file) => {
        const slug = file.data.slug!
        const at = tree.children.findIndex(
          (node) =>
            node.type === "code" && node.lang === "dataviewjs" && TEXTS_BLOCK.test(node.value),
        )
        if (at < 0) return
        const lang = languageOf(slug) === "en" ? "en" : "ru"
        const ui = UI[lang]
        const texts = textsFor(sourcesOnDisk(ctx).texts.get(slug) ?? [], lang)
        if (!texts.length) return
        const item = (text: (typeof texts)[number]): ListItem => ({
          type: "listItem",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  // CrawlLinks takes a full slug as it is and makes the address relative to the page.
                  url: text.slug,
                  children: [{ type: "text", value: titleOnDisk(ctx, text.slug) ?? text.title }],
                },
                {
                  type: "emphasis",
                  data: { hName: "span", hProperties: { className: ["sources-meta"] } },
                  children: [
                    {
                      type: "text",
                      value: [
                        ui.kinds[text.type] ?? text.type,
                        text.published ? dated(text.published, ui.locale) : "",
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    },
                  ],
                },
              ],
            },
          ],
        })
        tree.children.splice(at, 1, { type: "list", ordered: false, children: texts.map(item) })
        ;(file.data as { sourceTextsPlaced?: boolean }).sourceTextsPlaced = true
      },
    ]
  },
})

export const ContentProblems: QuartzEmitterPlugin = () => ({
  name: "ContentProblems",
  async emit(ctx, content) {
    const files = content.map(([, file]) => file.data)
    const unread = files
      .filter((file) => unreadable(file, ctx))
      .map(
        (file) => `${file.slug}: frontmatter not readable as YAML, links to the page are stripped`,
      )
    for (const problem of [...unread, ...contentProblems(pagesOf(files, ctx), slugTarget)]) {
      console.warn(`${CONTENT_PROBLEM_MARK}: ${problem}`)
    }
    return []
  },
})

// Under a text: its bibliography. Under a source card: the texts that name it.
export const SourceList = (() => {
  const List: QuartzComponent = ({ fileData, allFiles, ctx }) => {
    const slug = fileData.slug
    if (!slug) return null
    const lang = languageOf(slug) === "en" ? "en" : "ru"
    const ui = UI[lang]
    const sources = sourcesOf(allFiles, ctx)
    const references = sources.references.get(slug) ?? []
    const placed = (fileData as { sourceTextsPlaced?: boolean }).sourceTextsPlaced
    const texts = placed ? [] : textsFor(sources.texts.get(slug) ?? [], lang)
    const href = (target: string) => resolveRelative(slug, target as FullSlug)

    return (
      <>
        {references.length > 0 && (
          <section class="sources">
            <h2>{ui.sources}</h2>
            <ol>
              {references.map((ref) => {
                const { lead, title, tail } = referenceParts(ref)
                return (
                  <li>
                    {lead}
                    {ref.slug ? (
                      <a class="internal" href={href(ref.slug)}>
                        {title}
                      </a>
                    ) : (
                      title
                    )}
                    {tail}
                  </li>
                )
              })}
            </ol>
          </section>
        )}
        {texts.length > 0 && (
          <section class="sources">
            <h2>{ui.texts}</h2>
            <ul>
              {texts.map((text) => (
                <li>
                  <a class="internal" href={href(text.slug)}>
                    {text.title}
                  </a>
                  <span class="sources-meta">
                    {ui.kinds[text.type] ?? text.type}
                    {text.published && (
                      <>
                        {" · "}
                        <time datetime={text.published}>{dated(text.published, ui.locale)}</time>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    )
  }

  List.css = `
.sources {
  margin: 0 0 1.5rem;
}
.sources h2 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
}
.sources :is(ol, ul) {
  margin: 0;
  padding-left: 1.4rem;
}
.sources li {
  margin: 0.25rem 0;
}
.sources-meta {
  font-style: normal;
  margin-left: 0.6rem;
  font-size: 0.85rem;
  color: var(--gray);
}
`
  return List
}) satisfies QuartzComponentConstructor

// The stock Backlinks block would repeat on a source card the texts its typed section shows.
export function withoutSourceTexts(Stock: QuartzComponent): QuartzComponent {
  const Backlinks: QuartzComponent = (props) => {
    const listed = sourcesOf(props.allFiles, props.ctx).texts.get(props.fileData.slug ?? "")
    if (!listed) return <Stock {...props} />
    const shown = new Set(listed.map((text) => text.slug))
    return <Stock {...props} allFiles={props.allFiles.filter((file) => !shown.has(file.slug!))} />
  }
  Backlinks.css = Stock.css
  Backlinks.beforeDOMLoaded = Stock.beforeDOMLoaded
  Backlinks.afterDOMLoaded = Stock.afterDOMLoaded
  return Backlinks
}
