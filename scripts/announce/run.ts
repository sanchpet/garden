import type { Config } from "./config"
import type { FeedEntry } from "./feed"
import {
  isDelivered,
  isEmpty,
  mergeJournals,
  record,
  serializeJournal,
  type Delivery,
} from "./journal"
import { buildText, CAPTION_LIMIT, isNote, messageUrl, pageUrl } from "./message"
import { plan, seed } from "./plan"
import type { Store } from "./store"
import type { Probe } from "./page"
import { Rejected, type Message } from "./telegram"

export type Deps = {
  store: Store
  send(message: Message): Promise<number>
  // Resolves once the page is up or the deadline (epoch ms) has passed.
  waitForPage(url: string, deadline: number): Promise<Probe>
  now(): Date
  log(line: string): void
  warn(line: string): void
}

export type Options = { config: Config; token?: string; dryRun: boolean }

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

// Returns the process exit code.
export async function run(entries: FeedEntry[], options: Options, deps: Deps): Promise<number> {
  const { config, dryRun } = options
  const { log, warn, store } = deps
  const tag = dryRun ? "[dry run] " : ""
  const stamp = () => deps.now().toISOString()

  // Seeding does not wait for the token: the journal then marks the day the announcer was
  // switched on, and a text published before the secret arrives is still announced after it.
  const existing = await store.load()
  if (!existing || isEmpty(existing)) {
    const seeded = seed(entries, stamp())
    log(
      `${tag}No journal yet: recording ${entries.length} feed entries as delivered, sending nothing.`,
    )
    if (dryRun) log(serializeJournal(seeded).trimEnd())
    else if (entries.length)
      await store.save(seeded, `Seed the journal with ${entries.length} entries`)
    return 0
  }
  if (!options.token) {
    log("TELEGRAM_BOT_TOKEN is not set: nothing announced, the journal is not touched.")
    return 0
  }

  const planned = plan(entries, existing, config.channels, stamp())
  planned.warnings.forEach(warn)
  let journal = planned.journal
  for (const { id, channel, url } of planned.recorded)
    log(`${tag}Announced by hand, recorded as delivered: ${id} → ${channel} (${url})`)
  if (planned.recorded.length && !dryRun)
    journal = await store.save(
      journal,
      `Record ${planned.recorded.length} announcements made by hand`,
    )
  if (!planned.sends.length) log(`${tag}Nothing new to announce.`)

  let failures = 0
  // One budget for the whole run: all pages come with the same build.
  const deadline = deps.now().getTime() + (dryRun ? 0 : config.pageTimeoutSeconds * 1000)
  for (const { entry, channel, chat } of planned.sends) {
    let link: string
    try {
      link = pageUrl(entry.id)
    } catch (error) {
      warn(`${entry.id}: ${errorText(error)}, not announced`)
      continue
    }
    // A note is sent without a preview, so it does not wait for its page; a note with a picture
    // waits for the picture, which Telegram fetches from the site.
    const note = isNote(entry)
    const picture = note ? entry.image : undefined
    const probe =
      note && !picture
        ? { ready: true, detail: "not needed, no preview" }
        : await deps.waitForPage(picture ?? link, deadline)
    if (chat.unverified)
      warn(`${channel}: the chat ${chat.chat} is marked unverified in the config`)
    const text = buildText(entry, link)
    // A picture above the text when the note is too long to be a photo's caption.
    const message: Message = !picture
      ? { chat: chat.chat, text, previewUrl: note ? undefined : link }
      : buildText(entry, link, CAPTION_LIMIT) === text
        ? { chat: chat.chat, text, photoUrl: picture }
        : { chat: chat.chat, text, previewUrl: picture, previewAbove: true }
    if (dryRun) {
      const how = message.photoUrl ? "a photo" : message.previewAbove ? "a picture above" : "text"
      log(`[dry run] Would send to ${chat.chat} (${channel}) as ${how}; page: ${probe.detail}`)
      log(text.replace(/^/gm, "  | "))
      log(`[dry run] Would journal: ${entry.id} → ${channel}`)
      continue
    }
    if (!probe.ready) {
      warn(`${link}: the page is not up (${probe.detail}); left for the next build`)
      continue
    }
    // Read again right before sending: another run, or the owner by hand, may have recorded
    // this delivery while we were waiting for the page.
    try {
      const latest = await store.load()
      if (latest) journal = mergeJournals(latest, journal)
    } catch (error) {
      warn(`the journal could not be read before sending to ${chat.chat}: ${errorText(error)}`)
      return 1
    }
    if (isDelivered(journal, entry.id, channel)) {
      log(`Already delivered meanwhile, not sent: ${entry.id} → ${channel}`)
      continue
    }
    let delivery: Delivery
    try {
      const messageId = await deps.send(message).catch((error) => {
        if (!(message.photoUrl && error instanceof Rejected)) throw error
        warn(`${errorText(error)}; sending the picture above the text instead`)
        return deps.send({
          chat: chat.chat,
          text,
          previewUrl: message.photoUrl,
          previewAbove: true,
        })
      })
      delivery = { at: stamp(), origin: "sent", url: messageUrl(chat.chat, messageId), messageId }
      log(`Sent to ${chat.chat}: ${entry.id} (${delivery.url})`)
    } catch (error) {
      warn(errorText(error))
      failures++
      continue
    }
    // A message that is out but not recorded will be sent again by the next build. Stopping
    // here keeps that to this one message.
    try {
      journal = await store.save(
        record(journal, entry.id, channel, delivery),
        `Announce ${entry.id} in ${channel}`,
      )
    } catch (error) {
      warn(`sent to ${chat.chat} but the journal was not saved, stopping: ${errorText(error)}`)
      return 1
    }
  }
  return failures ? 1 : 0
}
