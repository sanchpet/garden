export type Fetch = typeof fetch
export type Sleep = (ms: number) => Promise<void>

export type Message = { chat: string; text: string; previewUrl: string }

const RETRIES = 3
const LONGEST_WAIT_SECONDS = 60

// The token is part of the request URL, so nothing that fetch throws is passed on as is:
// errors are rebuilt from the fields known to be free of it, and scrubbed once more.
export function redact(text: string, token: string): string {
  return token ? text.split(token).join("<token>") : text
}

type Reply = {
  ok?: boolean
  description?: string
  error_code?: number
  result?: { message_id?: number }
  parameters?: { retry_after?: number }
}

export async function sendMessage(
  token: string,
  message: Message,
  deps: { fetch: Fetch; sleep: Sleep; log: (line: string) => void },
): Promise<number> {
  const fail = (reason: string) =>
    new Error(redact(`sendMessage to ${message.chat} failed: ${reason}`, token))
  for (let attempt = 0; ; attempt++) {
    let status: number
    let reply: Reply
    try {
      const response = await deps.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: message.chat,
          text: message.text,
          parse_mode: "HTML",
          link_preview_options: { url: message.previewUrl },
        }),
        signal: AbortSignal.timeout(30_000),
      })
      status = response.status
      reply = (await response.json()) as Reply
    } catch (error) {
      // Not retried: the request may have reached Telegram, and a retry would post twice.
      const cause = error instanceof Error ? ((error.cause as Error)?.message ?? error.name) : ""
      throw fail(`no usable response (${cause || "unknown error"})`)
    }
    if (reply.ok && typeof reply.result?.message_id === "number") return reply.result.message_id
    const wait = reply.parameters?.retry_after
    if (status === 429 && wait !== undefined && wait <= LONGEST_WAIT_SECONDS && attempt < RETRIES) {
      deps.log(`Telegram asks to wait ${wait} s before sending to ${message.chat}`)
      await deps.sleep(wait * 1000)
      continue
    }
    throw fail(`${reply.error_code ?? status} ${reply.description ?? "no description"}`)
  }
}
