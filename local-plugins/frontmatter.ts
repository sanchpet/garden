import { parseDocument } from "yaml"

// What the stock parser reads as YAML: no language tag after the opening rule, or one of these.
const YAML_TAGS = new Set(["", "yaml", "yml", "json"])

// The frontmatter of a note, cut the way the stock pipeline cuts it: the file trimmed, then
// from a leading `---` to the first line that begins with `---`. A note without frontmatter
// has an empty one. Undefined is a block this parser cannot read: another language, or YAML
// it rejects, which the stock parser may still accept, so nothing can be said of the note.
export function frontmatterOf(text: string): Record<string, unknown> | undefined {
  const note = text.trim()
  if (!note.startsWith("---") || note[3] === "-") return {}
  const start = note.indexOf("\n")
  if (start === -1) return {}
  if (!YAML_TAGS.has(note.slice(3, start).trim().toLowerCase())) return undefined
  const end = note.indexOf("\n---", start)
  try {
    // parseDocument, not parse: parse prints the library's warnings, quoting the source line.
    const doc = parseDocument(note.slice(start, end === -1 ? undefined : end).replace(/\r$/, ""))
    if (doc.errors.length > 0) return undefined
    const data = doc.toJS()
    return data !== null && typeof data === "object" && !Array.isArray(data) ? data : {}
  } catch {
    return undefined
  }
}

// The rule of the stock RemoveDrafts filter: the boolean, or the string in exactly this spelling.
export function isDraft(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.draft === true || frontmatter.draft === "true"
}
