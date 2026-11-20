import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test, { describe } from "node:test"
import { emptyJournal, record, type Delivery, type Journal } from "./journal"
import { sandbox } from "./fixtures/git"
import { fileStore, gitStore } from "./store"

const sent: Delivery = { at: "2026-11-20T00:00:00.000Z", origin: "sent", messageId: 7 }
const one = record(emptyJournal(), "https://sanch.pet/a", "blog", sent)

describe("gitStore", () => {
  test("no branch means no journal", async (t) => {
    const { first } = sandbox(t)
    assert.strictEqual(await gitStore(first, "origin", "announce-state").load(), undefined)
  })

  test("the first save creates the branch with posted.json alone, later ones add commits", async (t) => {
    const { remote, first } = sandbox(t)
    const store = gitStore(first, "origin", "announce-state")
    await store.load()
    assert.deepStrictEqual(await store.save(one, "Seed"), one)
    const two = record(one, "https://sanch.pet/b", "blog", sent)
    await store.save(two, "Announce b")

    assert.strictEqual(remote(["ls-tree", "--name-only", "announce-state"]).trim(), "posted.json")
    assert.deepStrictEqual(remote(["log", "--format=%s", "announce-state"]).trim().split("\n"), [
      "Announce b",
      "Seed",
    ])
    assert.deepStrictEqual(await gitStore(first, "origin", "announce-state").load(), two)
    // The checkout the script runs in stays as it was.
    assert.strictEqual(first(["status", "--porcelain"]), "")
    assert.strictEqual(first(["rev-parse", "--abbrev-ref", "HEAD"]).trim(), "main")
  })

  test("a branch that moved meanwhile is merged with, not overwritten", async (t) => {
    const { remote, first, clone } = sandbox(t)
    const ours = gitStore(first, "origin", "announce-state")
    await ours.load()
    await ours.save(one, "Seed")

    const theirs = gitStore(clone("second"), "origin", "announce-state")
    const base = (await theirs.load()) as Journal
    await theirs.save(record(base, "https://sanch.pet/theirs", "blog", sent), "Theirs")

    const merged = await ours.save(record(one, "https://sanch.pet/ours", "blog", sent), "Ours")
    assert.deepStrictEqual(await gitStore(first, "origin", "announce-state").load(), merged)
    assert.deepStrictEqual(Object.keys(merged.delivered).sort(), [
      "https://sanch.pet/a",
      "https://sanch.pet/ours",
      "https://sanch.pet/theirs",
    ])
    assert.strictEqual(remote(["rev-list", "--count", "announce-state"]).trim(), "3")
  })

  test("an unreachable remote is an error, not an absent journal", async (t) => {
    const { first } = sandbox(t)
    await assert.rejects(gitStore(first, "/nonexistent/remote.git", "announce-state").load())
  })

  test("a broken journal is an error, not an absent one", async (t) => {
    const { first } = sandbox(t)
    const blob = first(["hash-object", "-w", "--stdin"], "{}").trim()
    const tree = first(["mktree"], `100644 blob ${blob}\tposted.json\n`).trim()
    const commit = first(["commit-tree", tree, "-m", "broken"]).trim()
    first(["push", "-q", "origin", `${commit}:refs/heads/announce-state`])
    await assert.rejects(gitStore(first, "origin", "announce-state").load(), /not a version 1/)
  })
})

describe("fileStore", () => {
  test("a missing file is no journal; a saved one is read back", async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "announce-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const store = fileStore(path.join(dir, "posted.json"))
    assert.strictEqual(await store.load(), undefined)
    await store.save(one, "ignored")
    assert.deepStrictEqual(await store.load(), one)
  })
})
