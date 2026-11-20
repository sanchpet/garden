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

export function buildText(entry: FeedEntry, link: string): string {
  const title = entry.title.trim()
  let summary = entry.summary?.trim() ?? ""
  if (summary === title) summary = ""
  const room = LIMIT - title.length - link.length - 4
  if (summary.length > room) summary = summary.slice(0, Math.max(room - 1, 0)).trimEnd() + "…"
  const parts = [`<b>${escapeHtml(title)}</b>`, escapeHtml(summary), escapeHtml(link)]
  return parts.filter(Boolean).join("\n\n")
}

export function messageUrl(chat: string, messageId: number): string | undefined {
  return chat.startsWith("@") ? `https://t.me/${chat.slice(1)}/${messageId}` : undefined
}
