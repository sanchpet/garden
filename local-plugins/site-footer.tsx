import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { FullSlug, resolveRelative } from "../quartz/util/path"
import { publishedSlugs } from "./garden"
import { languageOf, type Language } from "./languages"

const COLOPHON: Record<Language, string> = {
  ru: "колофон",
  en: "colophon",
}
const GITHUB = "https://github.com/sanchpet"
// The texts' licence; the engine's code is MIT, in its own repository.
const LICENCE = (lang: Language) => `https://creativecommons.org/licenses/by/4.0/deed.${lang}`

// The last line under every page, written in the margin like the labels of blocks: the
// colophon in the page's language once it is out, the owner's GitHub and the texts' licence.
export const SiteFooter = (() => {
  const Footer: QuartzComponent = ({ fileData, ctx }) => {
    const slug = fileData.slug as FullSlug
    const lang = languageOf(slug)
    if (!lang) return null
    const colophon = `${lang}/colophon` as FullSlug
    const showColophon = slug !== colophon && publishedSlugs(ctx).has(colophon)
    return (
      <p class="site-footer">
        {showColophon && (
          <a class="internal" href={resolveRelative(slug, colophon)}>
            {COLOPHON[lang]}
          </a>
        )}
        <a class="external" href={GITHUB} rel="me">
          github
        </a>
        <a class="external" href={LICENCE(lang)} rel="license">
          cc by
        </a>
      </p>
    )
  }

  Footer.css = `
.site-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.4rem;
  margin: 0 0 1.5rem;
  font-family: "Caveat", cursive;
  font-weight: 700;
  font-size: 1.15rem;
}
/* Straight under the page's closing rule, the line sits close to it. */
.center > hr:has(+ .page-footer > .site-footer:first-child) {
  margin-bottom: 0.5rem;
}
.page-footer:has(> .site-footer:first-child) {
  margin-top: 0;
}
.site-footer a {
  color: var(--gray);
  background-color: transparent !important;
  padding: 0 !important;
}
.site-footer a:hover {
  color: var(--tertiary);
}
`
  return Footer
}) satisfies QuartzComponentConstructor
