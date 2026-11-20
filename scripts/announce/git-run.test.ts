import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import test, { describe } from "node:test"
import { loadConfig } from "./config"
import type { FeedEntry } from "./feed"
import { sandbox } from "./fixtures/git"
import { fixture } from "./fixtures/load"
import { record, serializeJournal, type Journal } from "./journal"
import { run, type Deps } from "./run"
import { gitStore, JOURNAL_FILE, type Git, type Store } from "./store"

// The runner over the real git store: the cases where two writers, or a remote that refuses,
// would otherwise cost a duplicate message or a lost record.

const config = loadConfig(new URL("./config.json", import.meta.url).pathname)
const BRANCH = config.stateBranch
const fresh: FeedEntry = {
  id: "https://sanch.pet/ru/posts/svezhij",
  title: "Свежий",
  published: "2026-11-20T00:00:00Z",
  categories: ["sanchpetblog", "lytdybr"],
  related: [],
}
const theirs = { at: "2026-11-20T11:00:00.000Z", origin: "sent" as const, messageId: 1 }

function runner(store: Store) {
  const sent: string[] = []
  const warnings: string[] = []
  const deps: Deps = {
    store,
    send: async (message) => sent.push(message.chat),
    waitForStub: async () => ({ ready: true, detail: "stubbed" }),
    now: () => new Date("2026-11-20T12:00:00Z"),
    log: () => {},
    warn: (line) => void warnings.push(line),
  }
  const go = (entries: FeedEntry[]) => run(entries, { config, token: "t", dryRun: false }, deps)
  return { sent, warnings, deps, go }
}

async function seededRemote(t: { after(fn: () => void): void }) {
  const box = sandbox(t)
  assert.strictEqual(await runner(gitStore(box.first, "origin", BRANCH)).go(fixture()), 0)
  const read = async () => (await gitStore(box.first, "origin", BRANCH).load()) as Journal
  return { ...box, read }
}

describe("run over the git store", () => {
  test("a remote that refuses the push: one message out, the run stops, exit 1", async (t) => {
    const box = await seededRemote(t)
    const hook = path.join(box.remotePath, "hooks", "pre-receive")
    fs.writeFileSync(hook, "#!/bin/sh\necho 'pre-receive: refused' >&2\nexit 1\n", { mode: 0o755 })

    const r = runner(gitStore(box.first, "origin", BRANCH))
    const third = { ...fresh, id: "https://sanch.pet/ru/posts/tretij" }
    assert.strictEqual(await r.go([fresh, third]), 1)
    assert.deepStrictEqual(r.sent, ["@sanchpetblog"])
    assert.match(r.warnings[0], /journal was not saved, stopping/)
    assert.strictEqual(box.remote(["rev-list", "--count", BRANCH]).trim(), "1")
  })

  test("the remote moves once before the first push: their record survives every later save", async (t) => {
    const box = await seededRemote(t)
    const second = box.clone("second")
    const withTheirs = record(await box.read(), "https://sanch.pet/theirs", "lytdybr", theirs)
    let moved = false
    // The other writer gets in between our commit and our first push, synchronously.
    const racing: Git = (args, input) => {
      if (args[0] === "push" && !moved) {
        moved = true
        second(["fetch", "-q", "origin", BRANCH])
        const blob = second(["hash-object", "-w", "--stdin"], serializeJournal(withTheirs)).trim()
        const tree = second(["mktree"], `100644 blob ${blob}\t${JOURNAL_FILE}\n`).trim()
        const commit = second(["commit-tree", tree, "-p", "FETCH_HEAD", "-m", "Theirs"]).trim()
        second(["push", "-q", "origin", `${commit}:refs/heads/${BRANCH}`])
      }
      return box.first(args, input)
    }

    const r = runner(gitStore(racing, "origin", BRANCH))
    assert.strictEqual(await r.go([fresh]), 0)
    assert.deepStrictEqual(r.sent, ["@sanchpetblog", "@sanchpetlytdybr"])
    const journal = await box.read()
    assert.deepStrictEqual(journal.delivered["https://sanch.pet/theirs"].lytdybr, theirs)
    assert.deepStrictEqual(Object.keys(journal.delivered[fresh.id]).sort(), [
      "lytdybr",
      "sanchpetblog",
    ])
    // Seed, theirs, and one commit per message of ours.
    assert.strictEqual(box.remote(["rev-list", "--count", BRANCH]).trim(), "4")
  })

  test("a delivery pushed by another run while this one waits for the stub is not repeated", async (t) => {
    const box = await seededRemote(t)
    const other = gitStore(box.clone("second"), "origin", BRANCH)
    const r = runner(gitStore(box.first, "origin", BRANCH))
    let first = true
    // The other run announces the same text in the blog channel during our first wait.
    r.deps.waitForStub = async () => {
      if (first) {
        first = false
        const base = (await other.load()) as Journal
        await other.save(record(base, fresh.id, "sanchpetblog", theirs), "Theirs")
      }
      return { ready: true, detail: "stubbed" }
    }
    assert.strictEqual(await r.go([fresh]), 0)
    assert.deepStrictEqual(r.sent, ["@sanchpetlytdybr"])
    const journal = await box.read()
    assert.deepStrictEqual(journal.delivered[fresh.id].sanchpetblog, theirs)
    assert.strictEqual(journal.delivered[fresh.id].lytdybr.origin, "sent")
  })
})
