import type { QuartzEmitterPlugin } from "../quartz/plugins/types"
import { write } from "../quartz/plugins/emitters/helpers"
import type { FullSlug } from "../quartz/util/path"
import { LANGUAGES, languageOf } from "./bilingual"
import { coverOf } from "./cover"
import { buildFeed, entryOf, isPublication, renderFeed, type Page } from "./feed-atom"

export const FEED_SKIPPED_MARK = "garden: publication left out of the feed"

// What the site publishes, as a contract for readers and for the poster in publish.yaml:
// one Atom feed per language, holding posts and evergreen texts only. An entry's id is the
// text's address, so a new edition of a text moves `updated` and makes no new entry.
export const PublicationFeed: QuartzEmitterPlugin = () => ({
  name: "PublicationFeed",
  async *emit(ctx, content) {
    const { baseUrl, pageTitle } = ctx.cfg.configuration
    const site = { base: `https://${baseUrl}`, title: pageTitle, author: pageTitle }
    const pages: Page[] = []
    for (const [, file] of content) {
      // Notes only: tag and folder listings are virtual pages with no source file.
      if (!file.data.filePath?.endsWith(".md")) continue
      const frontmatter = (file.data.frontmatter ?? {}) as Record<string, unknown>
      const page: Page = {
        slug: file.data.slug!,
        lang: languageOf(file.data.slug),
        title: typeof frontmatter.title === "string" ? frontmatter.title : undefined,
        cover: coverOf(file.data),
        frontmatter,
      }
      pages.push(page)
      // Dates come from frontmatter alone; a text without one would otherwise vanish silently.
      if (isPublication(page) && page.lang && !entryOf(page, site.base)) {
        console.warn(`${FEED_SKIPPED_MARK}: ${page.slug} has neither published nor created`)
      }
    }
    for (const lang of LANGUAGES) {
      yield write({
        ctx,
        slug: `${lang}/feed` as FullSlug,
        ext: ".xml",
        content: renderFeed(buildFeed(pages, lang, site)),
      })
    }
  },
  externalResources: (ctx) => ({
    additionalHead: [
      (pageData) => (
        <link
          rel="alternate"
          type="application/atom+xml"
          title={ctx.cfg.configuration.pageTitle}
          href={`/${languageOf(pageData.slug) ?? "ru"}/feed.xml`}
        />
      ),
    ],
  }),
})
