import type { QuartzTransformerPlugin } from "../quartz/plugins/types"

// The texts sit in the vault under this folder. Obsidian writes a link whose file name is not
// unique (ru/ and en/ share them) as a path from the vault root, which the site does not know.
export const VAULT_FOLDER = "50-garden/"

const LINK = new RegExp(`(!?\\[\\[)${VAULT_FOLDER.replace("/", "\\/")}`, "g")
const FENCE = /^\s*(```|~~~)/

// A wikilink or embed written from the vault root, made relative to the texts' root. Code
// stays as written, since a code block may be showing the source of a link.
export function fromVaultRoot(src: string): string {
  if (!src.includes(`[[${VAULT_FOLDER}`)) return src
  let fence: string | null = null
  return src
    .split("\n")
    .map((line) => {
      const mark = FENCE.exec(line)?.[1]
      if (mark && (!fence || fence === mark)) {
        fence = fence ? null : mark
        return line
      }
      if (fence) return line
      return line
        .split(/(`[^`]*`)/)
        .map((part) => (part.startsWith("`") ? part : part.replace(LINK, "$1")))
        .join("")
    })
    .join("\n")
}

export const VaultPaths: QuartzTransformerPlugin = () => ({
  name: "VaultPaths",
  textTransform(_ctx, src) {
    return fromVaultRoot(src)
  },
})
