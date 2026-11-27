import type { Language } from "./languages"

// The site's own GoatCounter (homelab-v2 apps/stats); only counting is routed there publicly.
export const STATS = "https://stats.sanch.pet"

// Where count.js reads the count for a page: the path itself is one URL component.
export function counterUrl(path: string): string {
  return `${STATS}/counter/${encodeURIComponent(path)}.json`
}

const WORDS: Record<Language, Partial<Record<Intl.LDMLPluralRule, string>>> = {
  ru: { one: "просмотр", few: "просмотра", many: "просмотров", other: "просмотра" },
  en: { one: "view", other: "views" },
}

// The line under an article; nothing for a count that is missing, malformed or zero.
export function viewsLine(count: unknown, lang: Language): string | undefined {
  const n = Number(typeof count === "string" ? count.replace(/\D/g, "") : count)
  if (!Number.isInteger(n) || n <= 0) return undefined
  const words = WORDS[lang]
  const word = words[new Intl.PluralRules(lang).select(n)] ?? words.other
  return `${n.toLocaleString(lang)} ${word}`
}
