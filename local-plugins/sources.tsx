import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzEmitterPlugin, QuartzTransformerPlugin } from "../quartz/plugins/types"
import type { QuartzPluginData } from "../quartz/plugins/vfile"
import type { BuildCtx } from "../quartz/util/ctx"
import { FilePath, FullSlug, resolveRelative, slugifyFilePath } from "../quartz/util/path"
import { publishedSlugs } from "./garden"
import { unknownType } from "./kinds"
import { languageOf } from "./languages"
import {
  buildSources,
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
    kinds: { post: "пост", evergreen: "вечнозелёная заметка" } as Record<string, string>,
  },
  en: {
    locale: "en-US",
    sources: "Sources",
    texts: "Texts from this source",
    kinds: { post: "post", evergreen: "evergreen note" } as Record<string, string>,
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
    const published = publishedSlugs(ctx)
    const pages = ctx.allFiles.flatMap((fp): Page[] => {
      const slug = slugifyFilePath(fp)
      if (!fp.endsWith(".md") || !published.has(slug)) return []
      const text = fs.readFileSync(path.join(ctx.argv.directory, fp), "utf8")
      const yaml = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1]
      const frontmatter = yaml ? parse(yaml) : undefined
      return [
        { slug, frontmatter: frontmatter && typeof frontmatter === "object" ? frontmatter : {} },
      ]
    })
    sources = buildSources(pages, slugTarget)
    onDisk.set(ctx.allFiles, sources)
  }
  return sources
}

function pagesOf(files: QuartzPluginData[]): Page[] {
  return files.flatMap((file) =>
    file.slug
      ? [{ slug: file.slug, frontmatter: (file.frontmatter ?? {}) as Page["frontmatter"] }]
      : [],
  )
}

const rendered = new WeakMap<object, Sources>()
function sourcesOf(allFiles: QuartzPluginData[]): Sources {
  let sources = rendered.get(allFiles)
  if (!sources) {
    sources = buildSources(pagesOf(allFiles), slugTarget)
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

export const ContentProblems: QuartzEmitterPlugin = () => ({
  name: "ContentProblems",
  async emit(_ctx, content) {
    const pages = pagesOf(content.map(([, file]) => file.data))
    for (const { slug, frontmatter } of pages) {
      const type = unknownType(frontmatter.type)
      if (type) console.warn(`${CONTENT_PROBLEM_MARK}: ${slug}: unknown type "${type}"`)
    }
    for (const problem of buildSources(pages, slugTarget).problems) {
      console.warn(`${CONTENT_PROBLEM_MARK}: ${problem}`)
    }
    return []
  },
})

// Under a text: its bibliography. Under a source card: the texts that name it.
export const SourceList = (() => {
  const List: QuartzComponent = ({ fileData, allFiles }) => {
    const slug = fileData.slug
    if (!slug) return null
    const lang = languageOf(slug) === "en" ? "en" : "ru"
    const ui = UI[lang]
    const sources = sourcesOf(allFiles)
    const references = sources.references.get(slug) ?? []
    const texts = textsFor(sources.texts.get(slug) ?? [], lang)
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
                        <time datetime={text.published}>
                          {new Date(text.published).toLocaleDateString(ui.locale, {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                            timeZone: "UTC",
                          })}
                        </time>
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
    const listed = sourcesOf(props.allFiles).texts.get(props.fileData.slug ?? "")
    if (!listed) return <Stock {...props} />
    const shown = new Set(listed.map((text) => text.slug))
    return <Stock {...props} allFiles={props.allFiles.filter((file) => !shown.has(file.slug!))} />
  }
  Backlinks.css = Stock.css
  Backlinks.beforeDOMLoaded = Stock.beforeDOMLoaded
  Backlinks.afterDOMLoaded = Stock.afterDOMLoaded
  return Backlinks
}
