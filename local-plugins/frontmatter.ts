import { parse } from "yaml"

// The frontmatter of a note, cut the way the stock parser cuts it: from a leading `---` to the
// first line that begins with `---`. YAML that does not parse gives nothing here: the stock
// parser fails the build on that very file and names it.
export function frontmatterOf(text: string): Record<string, unknown> {
  const note = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  if (!note.startsWith("---") || note[3] === "-") return {}
  const start = note.indexOf("\n")
  if (start === -1) return {}
  const end = note.indexOf("\n---", start)
  try {
    const data = parse(note.slice(start, end === -1 ? undefined : end).replace(/\r$/, ""))
    return data !== null && typeof data === "object" && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

// The rule of the stock RemoveDrafts filter: the boolean, or the string in exactly this spelling.
export function isDraft(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.draft === true || frontmatter.draft === "true"
}
