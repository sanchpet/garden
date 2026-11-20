import type { Fetch, Sleep } from "./telegram"

export type Probe = { ready: boolean; detail: string }

export async function probeStub(url: string, fetch: Fetch): Promise<Probe> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (response.status !== 200) return { ready: false, detail: `HTTP ${response.status}` }
    const ready = /property=["']og:title["']/.test(await response.text())
    return { ready, detail: ready ? "200 with og:title" : "200 without og:title" }
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.name : "fetch failed" }
  }
}

// Pages may serve the previous deployment for some minutes after a new one is reported done.
export async function waitForStub(
  url: string,
  deadline: number,
  deps: { fetch: Fetch; sleep: Sleep; now: () => number; intervalMs?: number },
): Promise<Probe> {
  const interval = deps.intervalMs ?? 20_000
  for (;;) {
    const probe = await probeStub(url, deps.fetch)
    if (probe.ready || deps.now() + interval > deadline) return probe
    await deps.sleep(interval)
  }
}
