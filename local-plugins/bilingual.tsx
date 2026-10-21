import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzEmitterPlugin, QuartzTransformerPlugin } from "../quartz/plugins/types"
import { write } from "../quartz/plugins/emitters/helpers"
import { FilePath, FullSlug, resolveRelative, simplifySlug } from "../quartz/util/path"
import { publishedSlugs } from "./garden"
// @ts-ignore
import script from "./language-switch.inline"

// The texts live in one top-level folder per language; a translation sits at the same path in the other one.
export const LANGUAGES = ["ru", "en"] as const
type Language = (typeof LANGUAGES)[number]

const LABELS: Record<Language, { short: string; name: string; missing: string }> = {
  ru: { short: "RU", name: "Русский", missing: "Русской версии пока нет" },
  en: { short: "EN", name: "English", missing: "No English version yet" },
}

export function languageOf(slug: string | undefined): Language | undefined {
  const root = slug?.split("/")[0]
  return LANGUAGES.find((lang) => lang === root)
}

function inLanguage(slug: string, lang: Language): FullSlug {
  return `${lang}${slug.slice(slug.indexOf("/"))}` as FullSlug
}

// The page language comes from its folder, so the texts need no extra frontmatter.
export const PageLanguage: QuartzTransformerPlugin = () => ({
  name: "PageLanguage",
  markdownPlugins() {
    return [
      () => (_tree, file) => {
        const lang = languageOf(file.data.slug)
        if (!lang) return
        file.data.frontmatter ??= { title: file.stem ?? "" }
        file.data.frontmatter.lang ??= lang
      },
    ]
  },
})

// A wikilink resolves by note name, and both language folders hold the same names.
// Point every link at the page's own language when that version exists, else at the other one.
export const LanguageLinks: QuartzTransformerPlugin = () => ({
  name: "LanguageLinks",
  htmlPlugins(ctx) {
    const published = publishedSlugs(ctx)
    // Quartz leaves a link ambiguous when the name exists in both folders; match it by path suffix.
    const resolve = (target: string, lang: Language): FullSlug | undefined => {
      if (published.has(target)) {
        const twin = languageOf(target) && inLanguage(target, lang)
        return (twin && published.has(twin) ? twin : target) as FullSlug
      }
      const matches = [...published].filter(
        (slug) => slug.endsWith(`/${target}`) && languageOf(slug),
      )
      const own = matches.filter((slug) => languageOf(slug) === lang)
      const pick = (list: string[]) => list.sort((a, b) => a.length - b.length)[0]
      return (pick(own) ?? pick(matches)) as FullSlug | undefined
    }
    return [
      () => (tree: Root, file) => {
        const from = file.data.slug!
        const lang = languageOf(from)
        if (!lang) return
        visit(tree, "element", (node: Element) => {
          if (node.tagName !== "a") return
          const target = node.properties?.["data-slug"]
          if (typeof target !== "string") return
          const resolved = resolve(target, lang)
          if (!resolved || resolved === target) return
          const [, anchor] = String(node.properties.href ?? "").split("#")
          node.properties["data-slug"] = resolved
          node.properties.href = resolveRelative(from, resolved) + (anchor ? `#${anchor}` : "")
          const [stale, fresh] = [simplifySlug(target as FullSlug), simplifySlug(resolved)]
          file.data.links = file.data.links?.map((link) => (link === stale ? fresh : link))
        })
      },
    ]
  },
})

// The texts lived at the site root before the language folders; their old addresses keep working.
export const LegacyRedirects: QuartzEmitterPlugin = () => ({
  name: "LegacyRedirects",
  async *emit(ctx, content) {
    const published = publishedSlugs(ctx)
    for (const [, file] of content) {
      const slug = file.data.slug!
      if (languageOf(slug) !== "ru") continue
      const legacy = slug.slice("ru/".length) as FullSlug
      if (published.has(legacy)) continue
      const target = `https://${ctx.cfg.configuration.baseUrl}/${slug.replace(/(^|\/)index$/, "$1")}`
      yield write({
        ctx,
        slug: legacy,
        ext: ".html",
        content: `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>${file.data.frontmatter?.title ?? ""}</title>
<link rel="canonical" href="${target}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${resolveRelative(legacy, slug)}"></head></html>
`,
      }) as Promise<FilePath>
    }
  },
})

export const LanguageSwitch = (() => {
  const Switch: QuartzComponent = ({ fileData, ctx, allFiles }) => {
    const slug = fileData.slug!
    const current = languageOf(slug)
    const published = publishedSlugs(ctx)
    // The note about the site's languages lives in each language's home note, so it is edited as text.
    const noteOf = (lang: Language) =>
      allFiles.find((file) => file.slug === `${lang}/index`)?.frontmatter?.language_note as
        string | undefined
    return (
      <nav class="language-switch" aria-label="Language / Язык">
        {LANGUAGES.map((lang) => {
          const twin = current ? inLanguage(slug, lang) : undefined
          const translated = twin !== undefined && published.has(twin)
          const missing = current !== undefined && lang !== current && !translated
          const target = translated ? twin : (`${lang}/index` as FullSlug)
          const note = noteOf(lang)
          const option =
            lang === current ? (
              <span class="active" lang={lang} aria-current="true">
                {LABELS[lang].short}
              </span>
            ) : (
              <a
                href={resolveRelative(slug, target)}
                lang={lang}
                hreflang={lang}
                aria-label={missing ? LABELS[lang].missing : LABELS[lang].name}
                class={translated ? "twin" : missing ? "missing" : "home"}
                data-lang={lang}
                {...(translated ? { "data-router-ignore": "" } : {})}
              >
                {LABELS[lang].short}
              </a>
            )
          return (
            <span class="language-option">
              {option}
              <span class="language-note" role="tooltip" lang={lang}>
                <strong>{missing ? LABELS[lang].missing : LABELS[lang].name}</strong>
                {note && <span>{note}</span>}
              </span>
            </span>
          )
        })}
      </nav>
    )
  }

  Switch.afterDOMLoaded = script
  Switch.css = `
.language-switch {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
  font-size: 0.85rem;
  font-family: var(--headerFont);
}
.language-option {
  position: relative;
}
.language-option > :first-child {
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  text-decoration: none;
}
.language-switch .active {
  color: var(--light);
  background: var(--secondary);
}
.language-switch a {
  color: var(--darkgray);
  background: transparent;
}
.language-switch a:hover {
  color: var(--secondary);
}
.language-switch a.missing {
  opacity: 0.5;
}
.language-note {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 10;
  width: max-content;
  max-width: min(24rem, 80vw);
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--lightgray);
  border-radius: 6px;
  background: var(--light);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  color: var(--darkgray);
  font-family: var(--bodyFont);
  font-size: 0.85rem;
  line-height: 1.5;
  text-align: left;
  white-space: normal;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.language-note strong {
  display: block;
  color: var(--dark);
}
.language-note strong + span {
  display: block;
  margin-top: 0.3rem;
}
/* Touch screens have no hover: a tap switches the language, and a sticky note would cover the page. */
@media (hover: hover) {
  .language-option:hover .language-note {
    visibility: visible;
    opacity: 1;
    transition-delay: 0.15s;
  }
}
/* Keyboard focus only: a tap also focuses the link and would pin the note open. */
.language-option:has(:focus-visible) .language-note {
  visibility: visible;
  opacity: 1;
}
`
  return Switch
}) satisfies QuartzComponentConstructor
