import type { FeedEntry } from "./feed"

// Telegram counts the limit after entity parsing, so it applies to the unescaped text.
const LIMIT = 4096

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Share stubs mirror the site's paths on another host (local-plugins/share.tsx): Telegram's
// servers cannot reach the site itself, so a link to it would get no preview.
export function stubUrl(id: string, shareHost: string): string {
  const url = new URL(id)
  if (url.protocol !== "https:") throw new Error(`not an https URL: ${id}`)
  url.host = shareHost
  return url.href
}

// The author's announcement stands alone; without one the title does. The description is
// left out either way: the preview card under the message already shows it.
export function buildText(entry: FeedEntry, link: string): string {
  const room = LIMIT - link.length - 2
  let body = entry.content?.trim() ?? ""
  if (body.length > room) body = body.slice(0, room - 1).trimEnd() + "…"
  const head = body ? escapeHtml(body) : `<b>${escapeHtml(entry.title.trim().slice(0, room))}</b>`
  return `${head}\n\n${escapeHtml(link)}`
}

// Channels are configured by their public @name.
export function messageUrl(chat: string, messageId: number): string {
  return `https://t.me/${chat.replace(/^@/, "")}/${messageId}`
}
