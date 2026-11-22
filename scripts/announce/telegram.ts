export type Fetch = typeof fetch
export type Sleep = (ms: number) => Promise<void>

// Without `previewUrl` the message goes out with no link preview at all; `previewAbove` makes the
// preview a large picture over the text. With `photoUrl` the text is the caption of that photo.
export type Message = {
  chat: string
  text: string
  previewUrl?: string
  previewAbove?: boolean
  photoUrl?: string
}

// Telegram answered and refused: nothing was posted, so another way of sending is safe.
export class Rejected extends Error {}

const RETRIES = 3
const LONGEST_WAIT_SECONDS = 60

// The token is part of the request URL, so nothing that fetch throws is passed on as is:
// errors are rebuilt from the fields known to be free of it, and scrubbed once more.
export function redact(text: string, token: string): string {
  if (!token) return text
  return [token, encodeURIComponent(token)].reduce(
    (t, secret) => t.split(secret).join("<token>"),
    text,
  )
}

// A system error code such as ETIMEDOUT. Never the message: it may quote the request URL
// in a form `redact` does not recognise.
function reasonOf(error: unknown): string {
  const code = ((error as Error)?.cause as { code?: unknown } | undefined)?.code
  return typeof code === "string" && /^[A-Z][A-Z0-9_]*$/.test(code) ? code : "network error"
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
  const method = message.photoUrl ? "sendPhoto" : "sendMessage"
  const fail = (reason: string, Kind: new (text: string) => Error = Error) =>
    new Kind(redact(`${method} to ${message.chat} failed: ${reason}`, token))
  const body = message.photoUrl
    ? { chat_id: message.chat, photo: message.photoUrl, caption: message.text, parse_mode: "HTML" }
    : {
        chat_id: message.chat,
        text: message.text,
        parse_mode: "HTML",
        link_preview_options: !message.previewUrl
          ? { is_disabled: true }
          : message.previewAbove
            ? { url: message.previewUrl, prefer_large_media: true, show_above_text: true }
            : { url: message.previewUrl },
      }
  for (let attempt = 0; ; attempt++) {
    let status: number
    let reply: Reply
    try {
      const response = await deps.fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })
      status = response.status
      reply = (await response.json()) as Reply
    } catch (error) {
      // Not retried: the request may have reached Telegram, and a retry would post twice.
      throw fail(`no usable response (${reasonOf(error)})`)
    }
    if (reply.ok && typeof reply.result?.message_id === "number") return reply.result.message_id
    const wait = reply.parameters?.retry_after
    if (status === 429 && wait !== undefined && wait <= LONGEST_WAIT_SECONDS && attempt < RETRIES) {
      deps.log(`Telegram asks to wait ${wait} s before sending to ${message.chat}`)
      await deps.sleep(wait * 1000)
      continue
    }
    const reason = `${reply.error_code ?? status} ${reply.description ?? "no description"}`
    // A 4xx with a reply is a refusal; a 5xx may hide a message that went out.
    throw fail(reason, status >= 400 && status < 500 ? Rejected : Error)
  }
}
