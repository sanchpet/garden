// The texts live in one top-level folder per language; a translation sits at the same path in the other one.
export const LANGUAGES = ["ru", "en"] as const
export type Language = (typeof LANGUAGES)[number]

export function languageOf(slug: string | undefined): Language | undefined {
  const root = slug?.split("/")[0]
  return LANGUAGES.find((lang) => lang === root)
}

export function inLanguage<Slug extends string>(slug: Slug, lang: Language): Slug {
  return `${lang}${slug.slice(slug.indexOf("/"))}` as Slug
}

// The same page in the other languages, whether or not it exists.
export function twinsOf(slug: string): string[] {
  const own = languageOf(slug)
  if (!own || !slug.includes("/")) return []
  return LANGUAGES.filter((lang) => lang !== own).map((lang) => inLanguage(slug, lang))
}
