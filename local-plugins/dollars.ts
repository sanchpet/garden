import type { QuartzTransformerPlugin } from "../quartz/plugins/types"

// remark-math takes any two `$` in a paragraph for an inline formula: «выиграть 100$ … потеря
// 100$» became one, with the words between run together. Obsidian follows Pandoc instead: an
// opening `$` has a non-space after it, a closing one a non-space before it and no digit after.
// A `$` that does not pair up by that rule is escaped, so the site shows what Obsidian shows.

const FENCE = /^\s*(```|~~~)/

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c)
const isDigit = (c: string | undefined) => c !== undefined && /[0-9]/.test(c)

// Positions of the single `$` in a paragraph, outside code spans, escapes and `$$`.
function dollars(text: string): number[] {
  const found: number[] = []
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === "\\") {
      i++
    } else if (c === "`") {
      let run = 1
      while (text[i + run] === "`") run++
      const close = text.indexOf("`".repeat(run), i + run)
      if (close < 0) {
        i += run - 1
      } else {
        i = close + run - 1
      }
    } else if (c === "$") {
      if (text[i + 1] === "$") {
        const close = text.indexOf("$$", i + 2)
        i = close < 0 ? i + 1 : close + 1
      } else {
        found.push(i)
      }
    }
  }
  return found
}

export function escapeParagraph(text: string): string {
  const at = dollars(text)
  const lone = new Set<number>()
  for (let k = 0; k < at.length; k++) {
    const i = at[k]
    const opens = !isSpace(text[i + 1])
    const close = opens
      ? at.slice(k + 1).findIndex((j) => !isSpace(text[j - 1]) && !isDigit(text[j + 1]))
      : -1
    if (close < 0) {
      lone.add(i)
    } else {
      k += close + 1
    }
  }
  let out = ""
  for (let i = 0; i < text.length; i++) out += lone.has(i) ? "\\$" : text[i]
  return out
}

export function escapeLoneDollars(src: string): string {
  const front = /^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/.exec(src)?.[0] ?? ""
  const lines = src.slice(front.length).split("\n")
  const out: string[] = []
  let paragraph: string[] = []
  let fence: string | null = null
  let display = false
  const flush = () => {
    if (paragraph.length) out.push(...escapeParagraph(paragraph.join("\n")).split("\n"))
    paragraph = []
  }
  for (const line of lines) {
    const opened = FENCE.exec(line)?.[1]
    if (fence || display) {
      out.push(line)
      if (fence && opened === fence) fence = null
      else if (display && line.trim().endsWith("$$")) display = false
    } else if (opened) {
      flush()
      out.push(line)
      fence = opened
    } else if (line.trim().startsWith("$$") && !line.trim().slice(2).includes("$$")) {
      flush()
      out.push(line)
      display = true
    } else if (!line.trim()) {
      flush()
      out.push(line)
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return front + out.join("\n")
}

export const LoneDollars: QuartzTransformerPlugin = () => ({
  name: "LoneDollars",
  textTransform(_ctx, src) {
    return src.includes("$") ? escapeLoneDollars(src) : src
  },
})
