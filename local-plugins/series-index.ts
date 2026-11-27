// A series: texts that name the same `series` in frontmatter. Its members are the published
// texts of one language with that exact name, in the order they came out.
import { isText } from "./kinds"
import { languageOf } from "./languages"
import { dayOf } from "./stream-events"

export function seriesName(frontmatter: Record<string, unknown>): string | undefined {
  const name = frontmatter.series
  return typeof name === "string" && name.trim() ? name.trim() : undefined
}

// The slugs of the series the page belongs to, the page among them; empty when it belongs to none
// or is the only member, since a series of one has nowhere to lead.
export function seriesOf(
  pages: ReadonlyMap<string, Record<string, unknown>>,
  slug: string,
): string[] {
  const own = pages.get(slug)
  const name = own && isText(own.type) ? seriesName(own) : undefined
  if (!name) return []
  const lang = languageOf(slug)
  const members = [...pages]
    .filter(([s, fm]) => languageOf(s) === lang && isText(fm.type) && seriesName(fm) === name)
    .map(([s, fm]) => ({ slug: s, day: dayOf(fm.published ?? fm.created) }))
  if (members.length < 2) return []
  // Undated members go last; a shared day keeps a stable order by slug.
  return members
    .sort(
      (a, b) => (a.day ?? "9999").localeCompare(b.day ?? "9999") || a.slug.localeCompare(b.slug),
    )
    .map((member) => member.slug)
}

// A series name that only one text carries is most likely a typo in one of its members.
export function seriesProblems(pages: ReadonlyMap<string, Record<string, unknown>>): string[] {
  return [...pages].flatMap(([slug, fm]) => {
    if (fm.series === undefined || fm.series === null) return []
    const name = seriesName(fm)
    if (!name) return [`${slug}: series ${JSON.stringify(fm.series)} is not a name`]
    if (!isText(fm.type)) return [`${slug}: series "${name}" on a page that is not a text`]
    return seriesOf(pages, slug).length ? [] : [`${slug}: series "${name}" has no other member`]
  })
}
