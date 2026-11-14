import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { Date as DateTag } from "../quartz/components/Date"
import { FullSlug, resolveRelative, slugTag } from "../quartz/util/path"
import { plain, statusLabel } from "./bookcase"
import { RING, day, ringOf } from "./radar"

const LABELS = {
  ru: {
    tags: "Теги",
    modified: "Изменено",
    reading: "Чтение",
    minutes: "мин",
    author: "Автор",
    year: "Год",
    status: "Статус",
    ring: "На радаре",
    since: "С",
    repo: "Репозиторий",
  },
  en: {
    tags: "Tags",
    modified: "Modified",
    reading: "Reading",
    minutes: "min",
    author: "Author",
    year: "Year",
    status: "Status",
    ring: "On the radar",
    since: "Since",
    repo: "Repository",
  },
}
const WORDS_PER_MINUTE = 200

// Under the title: the note's annotation (`description`), then tags, last edit and reading
// time on one unframed line. Replaces the Properties table and the content-meta line.
// A catalogue card (`type: book`) or a radar entry (`type: tool`) may have no text yet: it
// shows its own fields instead.
export const NoteHeader = (() => {
  const Header: QuartzComponent = ({ cfg, fileData }) => {
    const fm = (fileData.frontmatter ?? {}) as Record<string, unknown>
    const text = (fileData as { text?: string }).text
    const classes = Array.isArray(fm.cssclasses) ? fm.cssclasses : []
    const book = fm.type === "book"
    const tool = fm.type === "tool"
    // The race calendar (`type: races`) is drawn under the note, which may have no text of its own.
    const calendar = fm.type === "races"
    if ((!text && !book && !tool && !calendar) || classes.includes("home")) return null

    const lang = cfg.locale.startsWith("ru") ? "ru" : "en"
    const l = LABELS[lang]
    const ring = ringOf(fm.ring)
    const fields: [string, string | undefined][] = book
      ? [
          [l.author, plain(fm.author)],
          [l.year, plain(fm.year)],
          [l.status, statusLabel(lang, fm.status)],
        ]
      : tool
        ? [
            [l.ring, ring && RING[lang][ring].name],
            [l.since, day(fm.since, lang) || undefined],
          ]
        : []
    const repo = tool && typeof fm.repo === "string" && /^https:\/\//.test(fm.repo) ? fm.repo : ""
    const annotation = typeof fm.description === "string" ? fm.description.trim() : ""
    const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : []
    const modified = fileData.dates?.modified
    const words = (text ?? "").split(/\s+/).filter(Boolean).length
    const minutes = Math.ceil(words / WORDS_PER_MINUTE)
    const slug = fileData.slug as FullSlug

    return (
      <div class="note-header">
        {annotation && <p class="note-annotation">{annotation}</p>}
        <dl class="note-meta">
          {fields.map(
            ([label, value]) =>
              value && (
                <div>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ),
          )}
          {repo && (
            <div>
              <dt>{l.repo}</dt>
              <dd>
                <a class="external" href={repo}>
                  {repo.replace(/^https:\/\/(www\.)?/, "")}
                </a>
              </dd>
            </div>
          )}
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
          {modified && !calendar && (
            <div>
              <dt>{l.modified}</dt>
              <dd>
                <DateTag date={modified} locale={cfg.locale} />
              </dd>
            </div>
          )}
          {minutes > 0 && (
            <div>
              <dt>{l.reading}</dt>
              <dd>
                {minutes} {l.minutes}
              </dd>
            </div>
          )}
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
