import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { loadConfig } from "./config"
import { parseFeed, type FeedEntry } from "./feed"
import { run } from "./run"
import { fileStore, gitStore, type Git } from "./store"
import { waitForStub } from "./stub"
import { redact, sendMessage } from "./telegram"

const USAGE = `Announce new feed entries in Telegram.

  npx tsx scripts/announce/cli.ts [options]

  --out <dir>        build output holding the feeds (default: public)
  --feed <file>      read this feed instead of the configured ones; repeatable
  --config <file>    default: scripts/announce/config.json
  --journal <file>   keep the journal in a local file instead of the state branch
  --remote <name>    git remote holding the state branch (default: origin)
  --dry-run          send nothing, push nothing, print what would be done

The bot token is read from TELEGRAM_BOT_TOKEN.`

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "public" },
    feed: { type: "string", multiple: true },
    config: {
      type: "string",
      default: path.join(path.dirname(fileURLToPath(import.meta.url)), "config.json"),
    },
    journal: { type: "string" },
    remote: { type: "string", default: "origin" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
})

if (values.help) {
  console.log(USAGE)
  process.exit(0)
}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? ""
const inActions = process.env.GITHUB_ACTIONS === "true"
const log = (line: string) => console.log(redact(line, token))
const warn = (line: string) => log(inActions ? `::warning::${line}` : `warning: ${line}`)

const git: Git = (args, input) =>
  execFileSync("git", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })

async function main(): Promise<number> {
  const config = loadConfig(values.config)
  const entries: FeedEntry[] = []
  for (const file of values.feed ?? config.feeds.map((feed) => path.join(values.out, feed))) {
    let feed: ReturnType<typeof parseFeed>
    try {
      feed = parseFeed(fs.readFileSync(file, "utf8"))
    } catch (error) {
      throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
    feed.warnings.forEach(warn)
    entries.push(...feed.entries)
  }
  return run(
    entries,
    { config, token, dryRun: values["dry-run"] },
    {
      store: values.journal
        ? fileStore(values.journal)
        : gitStore(git, values.remote, config.stateBranch),
      send: (message) => sendMessage(token, message, { fetch, sleep, log }),
      waitForStub: (url, deadline) => waitForStub(url, deadline, { fetch, sleep, now: Date.now }),
      now: () => new Date(),
      log,
      warn,
    },
  )
}

// Only the message is printed: a stack or a cause may carry the request URL, and with it the token.
main().then(
  (code) => process.exit(code),
  (error) => {
    const text = redact(error instanceof Error ? error.message : String(error), token)
    console.error(inActions ? `::error::${text}` : `error: ${text}`)
    process.exit(1)
  },
)
