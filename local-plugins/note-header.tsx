import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { Date as DateTag } from "../quartz/components/Date"
import { FullSlug, resolveRelative, slugTag } from "../quartz/util/path"

const LABELS = {
  ru: { tags: "Теги", modified: "Изменено", reading: "Чтение", minutes: "мин" },
  en: { tags: "Tags", modified: "Modified", reading: "Reading", minutes: "min" },
}
const WORDS_PER_MINUTE = 200

// Under the title: the note's annotation (`description`), then tags, last edit and reading
// time on one unframed line. Replaces the Properties table and the content-meta line.
export const NoteHeader = (() => {
  const Header: QuartzComponent = ({ cfg, fileData }) => {
    const fm = (fileData.frontmatter ?? {}) as Record<string, unknown>
    const text = (fileData as { text?: string }).text
    const classes = Array.isArray(fm.cssclasses) ? fm.cssclasses : []
    if (!text || classes.includes("home")) return null

    const l = cfg.locale.startsWith("ru") ? LABELS.ru : LABELS.en
    const annotation = typeof fm.description === "string" ? fm.description.trim() : ""
    const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : []
    const modified = fileData.dates?.modified
    const minutes = Math.max(
      1,
      Math.ceil(text.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE),
    )
    const slug = fileData.slug as FullSlug

    return (
      <div class="note-header">
        {annotation && <p class="note-annotation">{annotation}</p>}
        <dl class="note-meta">
          {tags.length > 0 && (
            <div>
              <dt>{l.tags}</dt>
              <dd class="note-tags">
                {tags.map((tag) => (
                  <a
                    class="internal tag-link"
                    href={resolveRelative(slug, `tags/${slugTag(tag)}` as FullSlug)}
                  >
                    {tag}
                  </a>
                ))}
              </dd>
            </div>
          )}
          {modified && (
            <div>
              <dt>{l.modified}</dt>
              <dd>
                <DateTag date={modified} locale={cfg.locale} />
              </dd>
            </div>
          )}
          <div>
            <dt>{l.reading}</dt>
            <dd>
              {minutes} {l.minutes}
            </dd>
          </div>
        </dl>
      </div>
    )
  }

  Header.css = `
.note-annotation {
  margin: 0.75rem 0 1.25rem;
  font-family: var(--bodyFont);
  font-style: italic;
  font-size: 1.1rem;
  color: var(--darkgray);
}
.note-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2.5rem;
  margin: 0 0 1.5rem;
  font-size: 0.9rem;
}
.note-meta dt {
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--gray);
}
.note-meta dd {
  margin: 0.2rem 0 0;
}
.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.note-tags a.internal.tag-link {
  padding: 0 0.3rem;
  border: 1px solid var(--lightgray);
  border-radius: 3px;
  background: none;
  font-size: 0.85rem;
}
`
  return Header
}) satisfies QuartzComponentConstructor
