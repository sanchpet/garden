import assert from "node:assert"
import test, { describe } from "node:test"
import { waitForPage } from "./page"
import type { Fetch } from "./telegram"

const PAGE = `<html><head><meta property="og:title" content="A"></head></html>`

// A clock that only moves when the code under test sleeps.
function harness(pages: (Response | Error)[]) {
  let time = 0
  let requests = 0
  const fetch = (async () => {
    const page = pages[Math.min(requests++, pages.length - 1)]
    if (page instanceof Error) throw page
    return page.clone()
  }) as unknown as Fetch
  const deps = {
    fetch,
    now: () => time,
    sleep: async (ms: number) => void (time += ms),
    intervalMs: 20_000,
  }
  return { deps, requests: () => requests, time: () => time }
}

describe("waitForPage", () => {
  test("a picture is ready once it is served as an image", async () => {
    const h = harness([new Response("x", { headers: { "content-type": "image/jpeg" } })])
    assert.deepStrictEqual(await waitForPage("https://sanch.pet/media/t.jpg", 60_000, h.deps), {
      ready: true,
      detail: "200 image",
    })
  })

  test("ready at once", async () => {
    const h = harness([new Response(PAGE)])
    assert.deepStrictEqual(await waitForPage("https://sanch.pet/a", 60_000, h.deps), {
      ready: true,
      detail: "200 with og:title",
    })
    assert.strictEqual(h.time(), 0)
  })

  test("waits through a 404, a page of the old deployment and a network error", async () => {
    const h = harness([
      new Response("", { status: 404 }),
      new Response("<html>old</html>"),
      new TypeError("fetch failed"),
      new Response(PAGE),
    ])
    assert.ok((await waitForPage("https://sanch.pet/a", 720_000, h.deps)).ready)
    assert.strictEqual(h.requests(), 5)
  })

  test("a page served by one replica is looked at again once the others have had time", async () => {
    const h = harness([new Response(PAGE), new Response(PAGE)])
    assert.deepStrictEqual(await waitForPage("https://sanch.pet/a", 300_000, h.deps), {
      ready: true,
      detail: "200 with og:title, still after 90 s",
    })
    assert.strictEqual(h.time(), 90_000)
  })

  test("a page that one replica served and the next did not is waited for again", async () => {
    const h = harness([
      new Response(PAGE),
      new Response("", { status: 404 }),
      new Response(PAGE),
      new Response(PAGE),
    ])
    const probe = await waitForPage("https://sanch.pet/a", 300_000, h.deps)
    assert.ok(probe.ready)
    assert.strictEqual(h.requests(), 4)
    assert.strictEqual(h.time(), 90_000 + 20_000 + 90_000)
  })

  test("a deadline that runs out while settling is not ready", async () => {
    const h = harness([new Response(PAGE), new Response("", { status: 404 })])
    const probe = await waitForPage("https://sanch.pet/a", 100_000, h.deps)
    assert.strictEqual(probe.ready, false)
  })

  test("gives up at the deadline and says what it last saw", async () => {
    const h = harness([new Response("", { status: 404 })])
    assert.deepStrictEqual(await waitForPage("https://sanch.pet/a", 60_000, h.deps), {
      ready: false,
      detail: "HTTP 404",
    })
    assert.ok(h.time() <= 60_000)
    assert.strictEqual(h.requests(), 4)
  })

  test("a deadline already passed still gets one look", async () => {
    const h = harness([new Response(PAGE)])
    assert.ok((await waitForPage("https://sanch.pet/a", 0, h.deps)).ready)
    assert.strictEqual(h.requests(), 1)
  })
})
