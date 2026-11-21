import assert from "node:assert"
import test, { describe } from "node:test"
import type { Config } from "./config"
import type { FeedEntry } from "./feed"
import { fixture } from "./fixtures/load"
import { ANY_CHANNEL, record, type Journal } from "./journal"
import { run, type Deps } from "./run"
import type { Message } from "./telegram"

const config: Config = {
  feeds: ["ru/feed.xml"],
  shareHost: "l.sanch.pet",
  stateBranch: "announce-state",
  stubTimeoutSeconds: 720,
  channels: {
    lytdybr: { chat: "@sanchpetlytdybr" },
    sanchpetblog: { chat: "@sanchpetblog" },
    sanchpethub: { chat: "@sanchpethub", unverified: true },
  },
}
const fresh: FeedEntry = {
  id: "https://sanch.pet/ru/posts/svezhij",
  title: "Свежий",
  summary: "Описание",
  content: "Анонс",
  published: "2026-11-20T00:00:00Z",
  categories: ["sanchpetblog"],
  related: [],
}
const both = { ...fresh, categories: ["sanchpetblog", "lytdybr"] }

function harness(over: Partial<Deps> = {}, journal?: Journal) {
  const state = {
    journal,
    saves: [] as string[],
    sent: [] as Message[],
    lines: [] as string[],
    warnings: [] as string[],
    waits: [] as number[],
  }
  const deps: Deps = {
    store: {
      load: async () => state.journal,
      save: async (next, subject) => {
        state.saves.push(subject)
        return (state.journal = next)
      },
    },
    send: async (message) => {
      state.sent.push(message)
      return 100 + state.sent.length
    },
    waitForStub: async (_url, deadline) => {
      state.waits.push(deadline)
      return { ready: true, detail: "200 with og:title" }
    },
    now: () => new Date("2026-11-20T12:00:00Z"),
    log: (line) => void state.lines.push(line),
    warn: (line) => void state.warnings.push(line),
    ...over,
  }
  const go = (entries: FeedEntry[], options: { token?: string; dryRun?: boolean } = {}) =>
    run(
      entries,
      { config, token: "token" in options ? options.token : "t", dryRun: !!options.dryRun },
      deps,
    )
  return { state, go }
}

// A harness whose journal already holds the fixture feed, as after the first build.
async function seeded(over: Partial<Deps> = {}) {
  const first = harness()
  await first.go(fixture())
  return harness(over, first.state.journal)
}

describe("run", () => {
  for (const token of ["t", "", undefined]) {
    test(`no journal, token ${JSON.stringify(token)}: the feed is recorded as delivered, nothing sent`, async () => {
      const h = harness()
      assert.strictEqual(await h.go(fixture(), { token }), 0)
      assert.deepStrictEqual(h.state.sent, [])
      assert.deepStrictEqual(h.state.saves, ["Seed the journal with 4 entries"])
      assert.strictEqual(Object.keys(h.state.journal!.delivered).length, 4)
      assert.ok(
        Object.values(h.state.journal!.delivered).every((r) => r[ANY_CHANNEL].origin === "seeded"),
      )
    })
  }

  test("an empty journal is seeded too", async () => {
    const h = harness({}, { version: 1, delivered: {} })
    await h.go(fixture())
    assert.deepStrictEqual(h.state.sent, [])
    assert.strictEqual(h.state.saves.length, 1)
  })

  test("a journal but no token: a notice, nothing sent, the journal untouched", async () => {
    const h = await seeded()
    const before = structuredClone(h.state.journal)
    assert.strictEqual(await h.go([fresh, ...fixture()], { token: "" }), 0)
    assert.strictEqual(await h.go([fresh, ...fixture()], { token: undefined }), 0)
    assert.deepStrictEqual(h.state.sent, [])
    assert.deepStrictEqual(h.state.saves, [])
    assert.deepStrictEqual(h.state.journal, before)
    assert.match(h.state.lines[0], /TELEGRAM_BOT_TOKEN is not set/)
  })

  test("a text published between the seed and the secret is announced once the secret is there", async () => {
    const h = await seeded()
    await h.go([fresh, ...fixture()], { token: "" })
    assert.strictEqual(await h.go([fresh, ...fixture()]), 0)
    assert.deepStrictEqual(
      h.state.sent.map((m) => m.chat),
      ["@sanchpetblog"],
    )
  })

  test("a note goes out without a preview and does not wait for its stub", async () => {
    const note: FeedEntry = {
      id: "https://sanch.pet/ru/notes/n",
      title: "Туман",
      content: "Туман.",
      categories: ["sanchpetblog"],
      related: [],
      kind: "note",
    }
    const h = await seeded({ waitForStub: async () => ({ ready: false, detail: "HTTP 404" }) })
    assert.strictEqual(await h.go([note, ...fixture()]), 0)
    assert.deepStrictEqual(h.state.sent, [
      {
        chat: "@sanchpetblog",
        text: 'Туман.\n\n<a href="https://sanch.pet/ru/notes/n">Прочесть заметку на сайте</a>',
        previewUrl: undefined,
      },
    ])
  })

  test("the run after seeding announces only what is new, and the one after that nothing", async () => {
    const h = await seeded()
    assert.strictEqual(await h.go([fresh, ...fixture()]), 0)
    assert.deepStrictEqual(h.state.sent, [
      {
        chat: "@sanchpetblog",
        text: "Анонс\n\nhttps://l.sanch.pet/ru/posts/svezhij",
        previewUrl: "https://l.sanch.pet/ru/posts/svezhij",
      },
    ])
    assert.deepStrictEqual(h.state.saves, [
      "Announce https://sanch.pet/ru/posts/svezhij in sanchpetblog",
    ])
    assert.deepStrictEqual(h.state.journal!.delivered[fresh.id].sanchpetblog, {
      at: "2026-11-20T12:00:00.000Z",
      origin: "sent",
      url: "https://t.me/sanchpetblog/101",
      messageId: 101,
    })

    assert.strictEqual(await h.go([{ ...fresh, updated: "2026-12-01T00:00:00Z" }, ...fixture()]), 0)
    assert.strictEqual(h.state.sent.length, 1)
    assert.strictEqual(h.state.saves.length, 1)
  })

  test("without an announcement the message is the title and the link", async () => {
    const h = await seeded()
    await h.go([{ ...fresh, content: undefined }])
    assert.strictEqual(
      h.state.sent[0].text,
      "<b>Свежий</b>\n\nhttps://l.sanch.pet/ru/posts/svezhij",
    )
  })

  test("the journal is saved after each message, not once at the end", async () => {
    const order: string[] = []
    const h = await seeded()
    const again = harness(
      {
        send: async (message) => order.push(`send ${message.chat}`),
        store: {
          load: async () => h.state.journal,
          save: async (journal, subject) => (order.push(`save: ${subject}`), journal),
        },
      },
      h.state.journal,
    )
    await again.go([both])
    assert.deepStrictEqual(order, [
      "send @sanchpetblog",
      "save: Announce https://sanch.pet/ru/posts/svezhij in sanchpetblog",
      "send @sanchpetlytdybr",
      "save: Announce https://sanch.pet/ru/posts/svezhij in lytdybr",
    ])
  })

  test("a failed send exits non-zero after journaling what did go out", async () => {
    const h = await seeded({
      send: async (m) => {
        if (m.chat === "@sanchpetblog")
          throw new Error("sendMessage to @sanchpetblog failed: 403 Forbidden")
        return 7
      },
    })
    assert.strictEqual(await h.go([both, ...fixture()]), 1)
    assert.deepStrictEqual(Object.keys(h.state.journal!.delivered[fresh.id]), ["lytdybr"])
    assert.deepStrictEqual(h.state.saves, [
      "Announce https://sanch.pet/ru/posts/svezhij in lytdybr",
    ])
    assert.match(h.state.warnings[0], /403 Forbidden/)

    // The next build retries only the channel that failed.
    const retry = harness({}, h.state.journal)
    assert.strictEqual(await retry.go([both]), 0)
    assert.deepStrictEqual(
      retry.state.sent.map((m) => m.chat),
      ["@sanchpetblog"],
    )
  })

  test("a journal that could not be saved stops the run: one message out, no more", async () => {
    const start = await seeded()
    const h = harness(
      {
        store: {
          load: async () => start.state.journal,
          save: async () => {
            throw new Error("push rejected")
          },
        },
      },
      start.state.journal,
    )
    const third = { ...fresh, id: "https://sanch.pet/ru/posts/tretij" }
    assert.strictEqual(await h.go([both, third]), 1)
    assert.strictEqual(h.state.sent.length, 1)
    assert.match(h.state.warnings[0], /journal was not saved, stopping: push rejected/)
  })

  test("what another writer added during a save is kept by the saves that follow", async () => {
    const start = await seeded()
    const theirs = { at: "2026-11-20T11:00:00.000Z", origin: "sent" as const, messageId: 1 }
    let remote = start.state.journal!
    let moved = false
    const h = harness({
      store: {
        // A stale read every time: only what `save` returns can tell about the other writer.
        load: async () => start.state.journal,
        save: async (next) => {
          if (!moved) {
            moved = true
            next = record(next, "https://sanch.pet/theirs", "lytdybr", theirs)
          } else {
            assert.ok(next.delivered["https://sanch.pet/theirs"], "their record was dropped")
          }
          return (remote = next)
        },
      },
    })
    assert.strictEqual(await h.go([both]), 0)
    assert.deepStrictEqual(Object.keys(remote.delivered[fresh.id]).sort(), [
      "lytdybr",
      "sanchpetblog",
    ])
    assert.deepStrictEqual(remote.delivered["https://sanch.pet/theirs"].lytdybr, theirs)
  })

  test("a delivery recorded by someone else while we waited is not sent again", async () => {
    const start = await seeded()
    let loads = 0
    const elsewhere = record(start.state.journal!, fresh.id, "sanchpetblog", {
      at: "2026-11-20T11:59:00.000Z",
      origin: "sent",
      messageId: 55,
    })
    const h = harness({
      store: {
        load: async () => (loads++ === 0 ? start.state.journal : elsewhere),
        save: async (next) => next,
      },
    })
    assert.strictEqual(await h.go([both]), 0)
    assert.deepStrictEqual(
      h.state.sent.map((m) => m.chat),
      ["@sanchpetlytdybr"],
    )
    assert.ok(h.state.lines.some((line) => /Already delivered meanwhile.*sanchpetblog/.test(line)))
    // One read to plan, one before each of the two sends.
    assert.strictEqual(loads, 3)
  })

  test("a journal that cannot be re-read before a send stops the run without sending", async () => {
    const start = await seeded()
    let loads = 0
    const h = harness({
      store: {
        load: async () => {
          if (loads++) throw new Error("remote gone")
          return start.state.journal
        },
        save: async (next) => next,
      },
    })
    assert.strictEqual(await h.go([both]), 1)
    assert.deepStrictEqual(h.state.sent, [])
  })

  test("a stub that never comes up: no message, no record, a warning, exit 0", async () => {
    const h = await seeded({ waitForStub: async () => ({ ready: false, detail: "HTTP 404" }) })
    assert.strictEqual(await h.go([fresh, ...fixture()]), 0)
    assert.deepStrictEqual(h.state.sent, [])
    assert.deepStrictEqual(h.state.saves, [])
    assert.strictEqual(h.state.journal!.delivered[fresh.id], undefined)
    assert.match(h.state.warnings[0], /share stub is not ready \(HTTP 404\)/)
  })

  test("all stubs share one deadline, the configured time from the start", async () => {
    const h = await seeded()
    await h.go([both])
    const start = new Date("2026-11-20T12:00:00Z").getTime()
    assert.deepStrictEqual(h.state.waits, [start + 720_000, start + 720_000])
  })

  test("a hand-made post found after seeding is recorded in one save and not sent", async () => {
    const h = await seeded()
    const byHand = { ...fresh, related: ["https://t.me/sanchpetblog/400"] }
    assert.strictEqual(await h.go([byHand]), 0)
    assert.deepStrictEqual(h.state.sent, [])
    assert.deepStrictEqual(h.state.saves, ["Record 1 announcements made by hand"])
    assert.strictEqual(
      h.state.journal!.delivered[fresh.id].sanchpetblog.url,
      "https://t.me/sanchpetblog/400",
    )
  })

  test("an unknown channel and an unverified chat are warned about", async () => {
    const h = await seeded()
    await h.go([{ ...fresh, categories: ["nowhere", "sanchpethub"] }])
    assert.deepStrictEqual(
      h.state.sent.map((m) => m.chat),
      ["@sanchpethub"],
    )
    assert.match(h.state.warnings[0], /unknown channel "nowhere"/)
    assert.match(h.state.warnings[1], /@sanchpethub is marked unverified/)
  })

  test("a dry run sends nothing and saves nothing, with or without a journal", async () => {
    const empty = harness()
    assert.strictEqual(await empty.go(fixture(), { dryRun: true }), 0)
    assert.strictEqual(empty.state.journal, undefined)
    assert.deepStrictEqual(empty.state.saves, [])

    const h = await seeded()
    const before = structuredClone(h.state.journal)
    const byHand = {
      ...fresh,
      id: "https://sanch.pet/b",
      related: ["https://t.me/sanchpetblog/400"],
    }
    assert.strictEqual(await h.go([fresh, byHand], { dryRun: true }), 0)
    assert.deepStrictEqual(h.state.sent, [])
    assert.deepStrictEqual(h.state.saves, [])
    assert.deepStrictEqual(h.state.journal, before)
    assert.ok(h.state.lines.some((line) => line.includes("Would send to @sanchpetblog")))
    assert.ok(h.state.lines.some((line) => line.includes("  | Анонс")))
  })
})
