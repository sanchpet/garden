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

function languageOf(slug: string | undefined): Language | undefined {
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
  const Switch: QuartzComponent = ({ fileData, ctx }) => {
    const slug = fileData.slug!
    const current = languageOf(slug)
    const published = publishedSlugs(ctx)
    return (
      <nav class="language-switch" aria-label="Language / Язык">
        {LANGUAGES.map((lang) => {
          if (lang === current) {
            return (
              <span class="active" lang={lang} aria-current="true" title={LABELS[lang].name}>
                {LABELS[lang].short}
              </span>
            )
          }
          const twin = current ? inLanguage(slug, lang) : undefined
          const translated = twin !== undefined && published.has(twin)
          const missing = current !== undefined && !translated
          const target = translated ? twin : (`${lang}/index` as FullSlug)
          return (
            <a
              href={resolveRelative(slug, target)}
              lang={lang}
              hreflang={lang}
              title={missing ? LABELS[lang].missing : LABELS[lang].name}
              class={translated ? "twin" : missing ? "missing" : "home"}
              data-lang={lang}
              {...(translated ? { "data-router-ignore": "" } : {})}
            >
              {LABELS[lang].short}
            </a>
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
.language-switch > * {
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
`
  return Switch
}) satisfies QuartzComponentConstructor
