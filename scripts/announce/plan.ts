import type { Channel } from "./config"
import { telegramPost, type FeedEntry } from "./feed"
import { ANY_CHANNEL, emptyJournal, isDelivered, record, type Journal } from "./journal"

export type Planned = { entry: FeedEntry; channel: string; chat: Channel }

export type Plan = {
  // The journal with the hand-made posts recorded; equal to the input when there are none.
  journal: Journal
  recorded: { id: string; channel: string; url: string }[]
  sends: Planned[]
  warnings: string[]
}

export function seed(entries: FeedEntry[], now: string): Journal {
  return entries.reduce(
    (journal, entry) =>
      record(journal, entry.id, ANY_CHANNEL, {
        at: now,
        origin: "seeded",
        url: telegramPost(entry),
      }),
    emptyJournal(),
  )
}

// Novelty is decided by the entry id alone: `updated` is never read, so a new edition of a
// text is not announced again.
export function plan(
  entries: FeedEntry[],
  journal: Journal,
  channels: Record<string, Channel>,
  now: string,
): Plan {
  const result: Plan = { journal, recorded: [], sends: [], warnings: [] }
  const oldestFirst = [...entries].sort((a, b) =>
    (a.published ?? "").localeCompare(b.published ?? ""),
  )
  for (const entry of oldestFirst) {
    const url = telegramPost(entry)
    for (const channel of new Set(entry.categories)) {
      if (isDelivered(result.journal, entry.id, channel)) continue
      if (url) {
        result.journal = record(result.journal, entry.id, channel, {
          at: now,
          origin: "related",
          url,
        })
        result.recorded.push({ id: entry.id, channel, url })
        continue
      }
      const chat = channels[channel]
      if (!chat) {
        result.warnings.push(`${entry.id}: unknown channel "${channel}", not announced there`)
        continue
      }
      result.sends.push({ entry, channel, chat })
    }
  }
  return result
}
