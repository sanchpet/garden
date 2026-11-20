// The journal of delivered announcements: entry id → channel key → delivery.

export type Delivery = {
  at: string
  // sent: by this script; related: the feed already links a Telegram post made by hand;
  // seeded: the entry was in the feed when the journal was first created.
  origin: "sent" | "related" | "seeded"
  url?: string
  messageId?: number
}

export type Journal = {
  version: 1
  delivered: Record<string, Record<string, Delivery>>
}

// A seeded entry is delivered for every channel, including ones added to it later.
export const ANY_CHANNEL = "*"

export function emptyJournal(): Journal {
  return { version: 1, delivered: {} }
}

export function isEmpty(journal: Journal): boolean {
  return Object.keys(journal.delivered).length === 0
}

export function isDelivered(journal: Journal, id: string, channel: string): boolean {
  const record = journal.delivered[id]
  return record !== undefined && (channel in record || ANY_CHANNEL in record)
}

export function record(journal: Journal, id: string, channel: string, delivery: Delivery): Journal {
  return {
    ...journal,
    delivered: { ...journal.delivered, [id]: { ...journal.delivered[id], [channel]: delivery } },
  }
}

// Ours wins: a record we hold describes a message we have just sent.
export function mergeJournals(theirs: Journal, ours: Journal): Journal {
  const delivered = { ...theirs.delivered }
  for (const [id, channels] of Object.entries(ours.delivered))
    delivered[id] = { ...delivered[id], ...channels }
  return { version: 1, delivered }
}

export function parseJournal(text: string): Journal {
  const data = JSON.parse(text) as Partial<Journal>
  if (data.version !== 1 || typeof data.delivered !== "object" || data.delivered === null)
    throw new Error("the journal is not a version 1 posted.json")
  return { version: 1, delivered: data.delivered }
}

export function serializeJournal(journal: Journal): string {
  const sorted = Object.fromEntries(
    Object.keys(journal.delivered)
      .sort()
      .map((id) => [id, journal.delivered[id]]),
  )
  return JSON.stringify({ version: 1, delivered: sorted }, null, 2) + "\n"
}
