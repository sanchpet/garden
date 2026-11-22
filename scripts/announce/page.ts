import type { Fetch, Sleep } from "./telegram"

export type Probe = { ready: boolean; detail: string }

export async function probePage(url: string, fetch: Fetch): Promise<Probe> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (response.status !== 200) return { ready: false, detail: `HTTP ${response.status}` }
    // A note's picture is waited for like a page: Telegram fetches it from the site.
    if (response.headers.get("content-type")?.startsWith("image/"))
      return { ready: true, detail: "200 image" }
    const ready = /property=["']og:title["']/.test(await response.text())
    return { ready, detail: ready ? "200 with og:title" : "200 without og:title" }
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.name : "fetch failed" }
  }
}

// Each replica of the site pulls the build on its own, up to a minute apart, so one serving it
// says nothing of the rest: Telegram, asking another, gets a 404 and keeps the broken preview.
// A page counts as up once it is still served after that minute has passed, with a margin.
const SETTLE_MS = 90_000

// The site takes the new build a minute or so after the publication is pushed.
export async function waitForPage(
  url: string,
  deadline: number,
  deps: { fetch: Fetch; sleep: Sleep; now: () => number; intervalMs?: number; settleMs?: number },
): Promise<Probe> {
  const interval = deps.intervalMs ?? 20_000
  const settle = deps.settleMs ?? SETTLE_MS
  for (;;) {
    const probe = await probePage(url, deps.fetch)
    // A deadline that leaves no room to settle (a dry run) takes the first look as it is.
    if (probe.ready && deps.now() + settle > deadline) return probe
    if (probe.ready) {
      await deps.sleep(settle)
      const again = await probePage(url, deps.fetch)
      if (again.ready)
        return { ready: true, detail: `${again.detail}, still after ${settle / 1000} s` }
    }
    if (deps.now() + interval > deadline) return { ...probe, ready: false }
    await deps.sleep(interval)
  }
}
