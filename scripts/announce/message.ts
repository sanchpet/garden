import type { FeedEntry } from "./feed"

// Telegram counts the limits after entity parsing, so they apply to the unescaped text.
const LIMIT = 4096
// A photo's caption: a note longer than this goes out as a message with its picture above.
export const CAPTION_LIMIT = 1024

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// The link of a message is the page's own address; an id that is not one cannot be announced.
export function pageUrl(id: string): string {
  const url = new URL(id)
  if (url.protocol !== "https:") throw new Error(`not an https URL: ${id}`)
  return url.href
}

// A note is posted whole, so a preview card would only repeat it: it goes out without one,
// and the way to its page is a phrase at the end instead of a bare address.
export function isNote(entry: FeedEntry): boolean {
  return entry.kind === "note"
}

const READ_ON_SITE = { ru: "Прочесть заметку на сайте", en: "Read the note on the site" }

function noteTail(entry: FeedEntry): { html: string; length: number } {
  const label = new URL(entry.id).pathname.startsWith("/en/") ? READ_ON_SITE.en : READ_ON_SITE.ru
  return { html: `<a href="${escapeHtml(entry.id)}">${label}</a>`, length: label.length }
}

// The author's announcement stands alone; without one the title does. The description is
// left out either way: the preview card under the message already shows it.
export function buildText(entry: FeedEntry, link: string, limit = LIMIT): string {
  const tail = isNote(entry) ? noteTail(entry) : { html: escapeHtml(link), length: link.length }
  const room = limit - tail.length - 2
  let body = entry.content?.trim() ?? ""
  if (body.length > room) body = body.slice(0, room - 1).trimEnd() + "…"
  const head = body ? escapeHtml(body) : `<b>${escapeHtml(entry.title.trim().slice(0, room))}</b>`
  return `${head}\n\n${tail.html}`
}

// Channels are configured by their public @name.
export function messageUrl(chat: string, messageId: number): string {
  return `https://t.me/${chat.replace(/^@/, "")}/${messageId}`
}
