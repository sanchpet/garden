import type { QuartzEmitterPlugin } from "../quartz/plugins/types"
import { write } from "../quartz/plugins/emitters/helpers"
import type { FullSlug } from "../quartz/util/path"
import { LANGUAGES, languageOf } from "./bilingual"
import { buildFeed, entryOf, renderFeed, type Entry } from "./feed-atom"

// publish.yaml greps the build log for this to report what the feed could not take as written.
export const FEED_PROBLEM_MARK = "garden: feed problem"

// What the site publishes, as a contract for readers and for the poster in publish.yaml:
// one Atom feed per language, holding posts and evergreen texts only. An entry's id is the
// text's address, so a new edition of a text moves `updated` and makes no new entry.
export const PublicationFeed: QuartzEmitterPlugin = () => ({
  name: "PublicationFeed",
  async *emit(ctx, content) {
    const { baseUrl, pageTitle } = ctx.cfg.configuration
    const site = { base: `https://${baseUrl}`, title: pageTitle, author: pageTitle }
    const entries: Entry[] = []
    for (const [, file] of content) {
      // Notes only: tag and folder listings are virtual pages with no source file.
      if (!file.data.filePath?.endsWith(".md")) continue
      const slug = file.data.slug!
      const frontmatter = (file.data.frontmatter ?? {}) as Record<string, unknown>
      const { entry, warnings } = entryOf({ slug, lang: languageOf(slug), frontmatter }, site.base)
      for (const warning of warnings) console.warn(`${FEED_PROBLEM_MARK}: ${warning}`)
      if (entry) entries.push(entry)
    }
    for (const lang of LANGUAGES) {
      yield write({
        ctx,
        slug: `${lang}/feed` as FullSlug,
        ext: ".xml",
        content: renderFeed(buildFeed(entries, lang, site)),
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
          href={`/${languageOf(pageData.slug) ?? LANGUAGES[0]}/feed.xml`}
        />
      ),
    ],
  }),
})
