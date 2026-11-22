import assert from "node:assert"
import test, { describe } from "node:test"
import { redact, sendMessage, type Fetch } from "./telegram"

const TOKEN = "123456:TEST-not-a-real-token"
const message = { chat: "@sanchpetblog", text: "<b>A</b>", previewUrl: "https://sanch.pet/a" }
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
  test("posts HTML with the preview taken from the page, returns the message id", async () => {
    const h = harness([() => reply(200, { ok: true, result: { message_id: 362 } })])
    assert.strictEqual(await sendMessage(TOKEN, message, h.deps), 362)
    assert.strictEqual(h.calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`)
    assert.deepStrictEqual(h.calls[0].body, {
      chat_id: "@sanchpetblog",
      text: "<b>A</b>",
      parse_mode: "HTML",
      link_preview_options: { url: "https://sanch.pet/a" },
    })
  })

  test("a message without a preview address asks for no preview", async () => {
    const h = harness([() => reply(200, { ok: true, result: { message_id: 1 } })])
    await sendMessage(TOKEN, { chat: "@sanchpetlytdybr", text: "A" }, h.deps)
    assert.deepStrictEqual(h.calls[0].body.link_preview_options, { is_disabled: true })
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

  test("a failure of fetch reports its code only, whatever its message quotes; no retry", async () => {
    const encoded = encodeURIComponent(TOKEN)
    assert.notStrictEqual(encoded, TOKEN)
    const failing = (cause: unknown) =>
      harness([
        () => {
          throw new TypeError(`fetch failed for bot${TOKEN}`, { cause })
        },
      ])
    const rejection = (h: ReturnType<typeof harness>) =>
      sendMessage(TOKEN, message, h.deps).then(
        () => assert.fail("must reject"),
        (e: Error) => e,
      )
    const url = `https://api.telegram.org/bot${encoded}/sendMessage and bot${TOKEN}`
    const coded = failing(
      Object.assign(new Error(`connect ETIMEDOUT ${url}`), { code: "ETIMEDOUT" }),
    )
    const error = await rejection(coded)
    assert.strictEqual(
      error.message,
      "sendMessage to @sanchpetblog failed: no usable response (ETIMEDOUT)",
    )
    assert.strictEqual(error.cause, undefined)
    assert.strictEqual(coded.calls.length, 1)

    for (const cause of [
      new Error(url),
      Object.assign(new Error("x"), { code: url }),
      url,
      undefined,
    ]) {
      const anonymous = await rejection(failing(cause))
      assert.strictEqual(
        anonymous.message,
        "sendMessage to @sanchpetblog failed: no usable response (network error)",
      )
      const all = `${anonymous.message}\n${anonymous.stack}`
      assert.ok(!all.includes(TOKEN) && !all.includes(encoded))
    }
  })
})

describe("redact", () => {
  test("replaces every occurrence and tolerates an empty token", () => {
    assert.strictEqual(redact(`a ${TOKEN} b ${TOKEN}`, TOKEN), "a <token> b <token>")
    assert.strictEqual(redact(`bot${encodeURIComponent(TOKEN)}/x`, TOKEN), "bot<token>/x")
    assert.strictEqual(redact("abc", ""), "abc")
  })
})
