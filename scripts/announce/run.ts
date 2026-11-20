import type { Config } from "./config"
import type { FeedEntry } from "./feed"
import { isEmpty, record, serializeJournal, type Delivery } from "./journal"
import { buildText, messageUrl, stubUrl } from "./message"
import { plan, seed } from "./plan"
import type { Store } from "./store"
import type { Probe } from "./stub"
import type { Message } from "./telegram"

export type Deps = {
  store: Store
  send(message: Message): Promise<number>
  // Resolves once the stub is ready or the deadline (epoch ms) has passed.
  waitForStub(url: string, deadline: number): Promise<Probe>
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
    await store.save(journal, `Record ${planned.recorded.length} announcements made by hand`)
  if (!planned.sends.length) log(`${tag}Nothing new to announce.`)

  let failures = 0
  // One budget for the whole run: all stubs come from the same Pages deployment.
  const deadline = deps.now().getTime() + (dryRun ? 0 : config.stubTimeoutSeconds * 1000)
  for (const { entry, channel, chat } of planned.sends) {
    let link: string
    try {
      link = stubUrl(entry.id, config.shareHost)
    } catch (error) {
      warn(`${entry.id}: ${errorText(error)}, not announced`)
      continue
    }
    const probe = await deps.waitForStub(link, deadline)
    if (chat.unverified)
      warn(`${channel}: the chat ${chat.chat} is marked unverified in the config`)
    const text = buildText(entry, link)
    if (dryRun) {
      log(`[dry run] Would send to ${chat.chat} (${channel}); share stub: ${probe.detail}`)
      log(text.replace(/^/gm, "  | "))
      log(`[dry run] Would journal: ${entry.id} → ${channel}`)
      continue
    }
    if (!probe.ready) {
      warn(`${link}: the share stub is not ready (${probe.detail}); left for the next build`)
      continue
    }
    let delivery: Delivery
    try {
      const messageId = await deps.send({ chat: chat.chat, text, previewUrl: link })
      delivery = { at: stamp(), origin: "sent", url: messageUrl(chat.chat, messageId), messageId }
      log(`Sent to ${chat.chat}: ${entry.id} (${delivery.url})`)
    } catch (error) {
      warn(errorText(error))
      failures++
      continue
    }
    // Kept in memory even if the push fails, so the next successful push carries it.
    journal = record(journal, entry.id, channel, delivery)
    try {
      await store.save(journal, `Announce ${entry.id} in ${channel}`)
    } catch (error) {
      warn(`the journal was not saved after sending to ${chat.chat}: ${errorText(error)}`)
      failures++
    }
  }
  return failures ? 1 : 0
}
