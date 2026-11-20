import assert from "node:assert"
import test, { describe } from "node:test"
import { redact, sendMessage, type Fetch } from "./telegram"

const TOKEN = "123456:TEST-not-a-real-token"
const message = { chat: "@sanchpetblog", text: "<b>A</b>", previewUrl: "https://l.sanch.pet/a" }
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

function harness(replies: (() => Response | Promise<Response>)[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const slept: number[] = []
  const logged: string[] = []
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) })
    return replies[calls.length - 1]()
  }) as unknown as Fetch
  const deps = {
    fetch,
    sleep: async (ms: number) => void slept.push(ms),
    log: (line: string) => void logged.push(line),
  }
  return { calls, slept, logged, deps }
}

describe("sendMessage", () => {
  test("posts HTML with the preview taken from the share stub, returns the message id", async () => {
    const h = harness([() => reply(200, { ok: true, result: { message_id: 362 } })])
    assert.strictEqual(await sendMessage(TOKEN, message, h.deps), 362)
    assert.strictEqual(h.calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`)
    assert.deepStrictEqual(h.calls[0].body, {
      chat_id: "@sanchpetblog",
      text: "<b>A</b>",
      parse_mode: "HTML",
      link_preview_options: { url: "https://l.sanch.pet/a" },
    })
  })

  test("waits as long as a 429 asks, then sends", async () => {
    const flood = () =>
      reply(429, {
        ok: false,
        error_code: 429,
        description: "Too Many Requests",
        parameters: { retry_after: 7 },
      })
    const h = harness([flood, flood, () => reply(200, { ok: true, result: { message_id: 1 } })])
    assert.strictEqual(await sendMessage(TOKEN, message, h.deps), 1)
    assert.deepStrictEqual(h.slept, [7000, 7000])
  })

  test("gives up on a 429 that keeps coming or asks for too long", async () => {
    const flood = (seconds: number) => () =>
      reply(429, {
        ok: false,
        error_code: 429,
        description: "Too Many Requests",
        parameters: { retry_after: seconds },
      })
    const stubborn = harness(Array(10).fill(flood(1)))
    await assert.rejects(sendMessage(TOKEN, message, stubborn.deps), /429 Too Many Requests/)
    assert.strictEqual(stubborn.calls.length, 4)
    const long = harness([flood(3600)])
    await assert.rejects(sendMessage(TOKEN, message, long.deps), /429/)
    assert.deepStrictEqual(long.slept, [])
  })

  test("a Bot API error carries its description and never the token", async () => {
    const h = harness([
      () =>
        reply(403, {
          ok: false,
          error_code: 403,
          description: "Forbidden: bot is not a member of the channel chat",
        }),
    ])
    const error = await sendMessage(TOKEN, message, h.deps).then(
      () => assert.fail("must reject"),
      (e: Error) => e,
    )
    assert.strictEqual(
      error.message,
      "sendMessage to @sanchpetblog failed: 403 Forbidden: bot is not a member of the channel chat",
    )
    assert.ok(!`${error.message}\n${error.stack}\n${String(error.cause)}`.includes(TOKEN))
  })

  test("a failure of fetch that quotes the request URL is scrubbed, and is not retried", async () => {
    const h = harness([
      () => {
        const cause = new Error(
          `connect ETIMEDOUT https://api.telegram.org/bot${TOKEN}/sendMessage`,
        )
        throw new TypeError("fetch failed", { cause })
      },
    ])
    const error = await sendMessage(TOKEN, message, h.deps).then(
      () => assert.fail("must reject"),
      (e: Error) => e,
    )
    assert.match(
      error.message,
      /no usable response \(connect ETIMEDOUT .*bot<token>\/sendMessage\)/,
    )
    assert.ok(!`${error.message}\n${error.stack}`.includes(TOKEN))
    assert.strictEqual(error.cause, undefined)
    assert.strictEqual(h.calls.length, 1)
  })
})

describe("redact", () => {
  test("replaces every occurrence and tolerates an empty token", () => {
    assert.strictEqual(redact(`a ${TOKEN} b ${TOKEN}`, TOKEN), "a <token> b <token>")
    assert.strictEqual(redact("abc", ""), "abc")
  })
})
