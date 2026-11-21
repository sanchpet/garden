// The content kinds of the garden and their species; a note names its species in frontmatter `type`.
export const KINDS = {
  text: ["post", "evergreen"],
  source: ["book", "course", "guide", "platform"],
  assessed: ["tool"],
  module: ["races"],
} as const

export type Kind = keyof typeof KINDS
export type Species = (typeof KINDS)[Kind][number]

export function kindOf(type: unknown): Kind | undefined {
  const kinds = Object.keys(KINDS) as Kind[]
  return kinds.find((kind) => (KINDS[kind] as readonly unknown[]).includes(type))
}

export const isText = (type: unknown) => kindOf(type) === "text"
export const isSource = (type: unknown) => kindOf(type) === "source"

// Indexes, hubs and the home note carry no type; anything else the registry lacks is a typo,
// a new species or a value that is not a word at all.
export function isUnknownType(type: unknown): boolean {
  const absent = type === undefined || type === null || (typeof type === "string" && !type.trim())
  return !absent && !kindOf(type)
}
