import type { Race, RacesUi } from "./races"

// The calendar in the browser: fetches the feed once, filters it by the form, keeps the
// filters in the query string so a filtered view can be linked.

type Feed = {
  owner: string
  regions: { key: string; countries: string[] }[]
  countries: Record<string, string>
  events: Race[]
}

const PAGE = 150
const MARATHON_KM = 42.195
const LEAFLET = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/"
const CLUSTER = "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/"
const ASSETS: [string, string][] = [
  [
    `${LEAFLET}leaflet.css`,
    "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H",
  ],
  [
    `${CLUSTER}MarkerCluster.css`,
    "sha384-pmjIAcz2bAn0xukfxADbZIb3t8oRT9Sv0rvO+BR5Csr6Dhqq+nZs59P0pPKQJkEV",
  ],
  [
    `${LEAFLET}leaflet.js`,
    "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH",
  ],
  [
    `${CLUSTER}leaflet.markercluster.js`,
    "sha384-eXVCORTRlv4FUUgS/xmOyr66XBVraen8ATNLMESp92FKXLAMiKkerixTiBvXriZr",
  ],
]

// One download per page load, however often the reader comes back to the calendar.
let feedRequest: Promise<Feed> | undefined
let mapLibrary: Promise<void> | undefined

function loadAsset([url, integrity]: [string, string]): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = url.endsWith(".css")
      ? Object.assign(document.createElement("link"), { rel: "stylesheet", href: url })
      : Object.assign(document.createElement("script"), { src: url })
    el.integrity = integrity
    el.crossOrigin = "anonymous"
    // Kept across SPA navigation: the library is loaded once.
    el.setAttribute("spa-preserve", "")
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(url))
    document.head.append(el)
  })
}

// The cluster plugin extends the global L, so the four files load in order.
function loadMapLibrary(): Promise<void> {
  mapLibrary ??= ASSETS.reduce((p, asset) => p.then(() => loadAsset(asset)), Promise.resolve())
  mapLibrary.catch(() => (mapLibrary = undefined))
  return mapLibrary
}

function esc(text: unknown): string {
  return String(text ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  )
}

function mount(root: HTMLElement): () => void {
  const ui = JSON.parse(root.dataset.ui!) as RacesUi
  const lang = root.dataset.lang!
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const form = $<HTMLFormElement>(".races-form")
  const list = $(".races-list")
  const more = $<HTMLButtonElement>(".races-more")
  const summary = $(".races-summary")
  const mapBox = $(".races-map")
  const mapNote = $(".races-map-note")
  const today = new Date().toISOString().slice(0, 10)
  const cleanups: (() => void)[] = []
  const on = (el: EventTarget, type: string, fn: EventListener) => {
    el.addEventListener(type, fn)
    cleanups.push(() => el.removeEventListener(type, fn))
  }

  let regionNames: Intl.DisplayNames | undefined
  try {
    regionNames = new Intl.DisplayNames([lang], { type: "region" })
  } catch {}

  const state = { tab: "all", view: "list", shown: PAGE, filtered: [] as Race[] }
  let data: Feed
  let map: any
  let cluster: any
  let pickLayer: any
  let alive = true
  cleanups.push(() => {
    alive = false
    map?.remove()
  })

  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(ui.locale, { timeZone: "UTC", ...opts })
  const kmText = (km: number) => (Number.isInteger(km) ? String(km) : km.toFixed(1))
  const maxKm = (e: Race) => e.distances.reduce((m, d) => Math.max(m, d.km), 0)
  const ownerPick = (e: Race) => e.picks?.find((p) => p.person === data.owner)
  const linkOf = (e: Race) => e.registration?.url || e.sources[0]?.url || "#"
  const flag = (code?: string) =>
    !code || code.length !== 2 || code === "XK"
      ? ""
      : String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
  function countryName(code?: string): string {
    if (!code) return ""
    try {
      const name = regionNames?.of(code)
      if (name && name !== code) return name
    } catch {}
    return data.countries[code] ?? code
  }
  const placeOf = (e: Race) => [e.city, countryName(e.country)].filter(Boolean).join(", ")
  const pickText = (status: string) => (ui.pick as Record<string, string>)[status] ?? status

  function readFilters() {
    const f = new FormData(form)
    const text = (k: string) => String(f.get(k) ?? "")
    const num = (k: string) => (text(k) === "" ? null : Number(text(k)))
    return {
      q: text("q").trim().toLowerCase(),
      region: text("region"),
      country: text("country"),
      from: text("from"),
      to: text("to"),
      disciplines: f.getAll("discipline") as string[],
      kmin: num("kmin"),
      kmax: num("kmax"),
      emin: num("emin"),
      emax: num("emax"),
      ultra: f.get("ultra") === "on",
    }
  }

  function matches(e: Race, f: ReturnType<typeof readFilters>, region: Set<string> | null) {
    // Picked races stay in the feed after race day; elsewhere only upcoming ones are listed.
    if (state.tab === "mine" ? !ownerPick(e) : e.end_date < today) return false
    if (f.country && e.country !== f.country) return false
    if (region && !(e.country && region.has(e.country))) return false
    if (f.from && e.end_date < f.from) return false
    if (f.to && e.start_date > f.to) return false
    if (f.disciplines.length && !f.disciplines.includes(e.discipline)) return false
    if (f.ultra && maxKm(e) <= MARATHON_KM) return false
    // Distance and climb filters pass a race when any one of its distances fits.
    if (f.kmin !== null || f.kmax !== null || f.emin !== null || f.emax !== null) {
      const fits = e.distances.some(
        (d) =>
          (f.kmin === null || d.km >= f.kmin) &&
          (f.kmax === null || d.km <= f.kmax) &&
          (f.emin === null || (d.climb_m ?? -1) >= f.emin) &&
          (f.emax === null || (d.climb_m ?? Infinity) <= f.emax),
      )
      if (!fits) return false
    }
    if (f.q) {
      const hay = [e.name, e.city, e.country, countryName(e.country), data.countries[e.country!]]
        .join(" ")
        .toLowerCase()
      if (!f.q.split(/\s+/).every((w) => hay.includes(w))) return false
    }
    return true
  }

  function apply() {
    const f = readFilters()
    const region = data.regions.find((r) => r.key === f.region)
    const countries = region ? new Set(region.countries) : null
    state.filtered = data.events.filter((e) => matches(e, f, countries))
    state.shown = PAGE
    saveToUrl()
    render()
  }

  function row(e: Race): string {
    const pick = ownerPick(e)
    const multiDay = e.end_date !== e.start_date
    const under = multiDay
      ? `${ui.until} ${fmt(e.end_date, { day: "numeric", month: "short" })}`
      : fmt(e.start_date, { weekday: "short" })
    const status = e.registration?.status
    const badges = [
      e.start_date < today && e.end_date >= today
        ? `<span class="races-badge is-ongoing">${esc(ui.ongoing)}</span>`
        : "",
      status && (ui.registration as Record<string, string>)[status]
        ? `<span class="races-badge">${esc((ui.registration as Record<string, string>)[status])}</span>`
        : "",
      pick ? `<span class="races-badge is-pick">${esc(pickText(pick.status))}</span>` : "",
    ].join("")
    const chips = e.distances
      .map(
        (d) =>
          `<span class="races-chip">${kmText(d.km)} ${esc(ui.km)}${d.climb_m ? ` ↑${d.climb_m} ${esc(ui.m)}` : ""}</span>`,
      )
      .join("")
    const sources = e.sources
      .map((s) => `<a href="${esc(s.url)}" rel="noopener" data-router-ignore>${esc(s.source)}</a>`)
      .join(", ")
    const discipline = (ui.disciplines as Record<string, string>)[e.discipline] ?? e.discipline
    return `<li class="races-row${pick ? " is-picked" : ""}">
      <div class="races-when">${esc(fmt(e.start_date, { day: "numeric", month: "short" }))}<small>${esc(under)}</small></div>
      <div class="races-what">
        <a class="races-name" href="${esc(linkOf(e))}" rel="noopener" data-router-ignore>${esc(e.name)}</a>
        <div class="races-meta"><span>${flag(e.country)} ${esc(placeOf(e) || ui.nowhere)}</span>
          <span>${esc(discipline)}</span>${chips}${badges}</div>
        <details><summary>${esc(ui.details)}</summary>${esc(ui.listedBy)} ${sources}. ${esc(ui.eventId)} <code>${esc(e.id)}</code></details>
      </div>
    </li>`
  }

  function renderList() {
    const items = state.filtered.slice(0, state.shown)
    if (!items.length) {
      list.innerHTML = `<li class="races-empty">${esc(state.tab === "mine" ? ui.noPicks : ui.none)}</li>`
      more.hidden = true
      return
    }
    let month = ""
    const html: string[] = []
    for (const e of items) {
      const m = fmt(e.start_date, { month: "long", year: "numeric" }).replace(/\s*г\.$/, "")
      if (m !== month) {
        html.push(`<li class="races-month">${esc(m)}</li>`)
        month = m
      }
      html.push(row(e))
    }
    list.innerHTML = html.join("")
    const left = state.filtered.length - state.shown
    more.hidden = left <= 0
    more.textContent = ui.more.replace("{n}", String(left))
  }

  function popup(e: Race): string {
    const when = fmt(e.start_date, { day: "numeric", month: "short", year: "numeric" })
    const km = e.distances.map((d) => kmText(d.km)).join(" / ")
    const pick = ownerPick(e)
    return `<strong><a href="${esc(linkOf(e))}" rel="noopener" data-router-ignore>${esc(e.name)}</a></strong><br>
      ${esc(when)} · ${esc(placeOf(e))}<br>${km ? `${esc(km)} ${esc(ui.km)}` : ""}
      ${pick ? `<br>★ ${esc(pickText(pick.status))}` : ""}`
  }

  async function renderMap() {
    try {
      await loadMapLibrary()
    } catch {
      mapNote.hidden = false
      mapNote.textContent = ui.mapFailed
      return
    }
    if (!alive || state.view !== "map") return
    const L = (window as any).L
    if (!map) {
      map = L.map(mapBox, { worldCopyJump: true }).setView([30, 20], 2)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)
      cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 })
      map.addLayer(cluster)
      // Picks stay out of the clusters, or a few stars drown among thousands of races.
      pickLayer = L.layerGroup().addTo(map)
    }
    cluster.clearLayers()
    pickLayer.clearLayers()
    const located = state.filtered.filter((e) => e.lat != null && e.lon != null)
    const dot = L.divIcon({ className: "races-dot", iconSize: [14, 14] })
    const star = L.divIcon({ className: "races-star", html: "★", iconSize: [26, 26] })
    const plain = []
    for (const e of located) {
      if (ownerPick(e)) {
        L.marker([e.lat, e.lon], { icon: star, zIndexOffset: 1000 })
          .bindPopup(popup(e))
          .addTo(pickLayer)
      } else {
        plain.push(L.marker([e.lat, e.lon], { icon: dot }).bindPopup(popup(e)))
      }
    }
    cluster.addLayers(plain)
    if (located.length) {
      const bounds = L.latLngBounds(located.map((e) => [e.lat, e.lon]))
      setTimeout(() => map.fitBounds(bounds, { maxZoom: 9, padding: [30, 30] }), 0)
    }
    const missing = state.filtered.length - located.length
    mapNote.hidden = missing === 0
    mapNote.textContent = ui.noPosition
      .replace("{n}", String(missing))
      .replace("{total}", String(state.filtered.length))
    setTimeout(() => map.invalidateSize(), 0)
  }

  function render() {
    const total = data.events.filter((e) => e.end_date >= today).length
    const n = state.filtered.length
    summary.textContent =
      state.tab === "mine"
        ? `${ui.mine}: ${n}`
        : ui.count
            .replace("{n}", n.toLocaleString(ui.locale))
            .replace("{total}", total.toLocaleString(ui.locale))
    mapBox.hidden = state.view !== "map"
    list.hidden = state.view !== "list"
    mapNote.hidden = true
    if (state.view === "map") {
      more.hidden = true
      void renderMap()
    } else {
      renderList()
    }
  }

  function saveToUrl() {
    const params = new URLSearchParams()
    for (const [k, v] of new FormData(form)) if (v) params.append(k, String(v))
    if (state.tab !== "all") params.set("tab", state.tab)
    if (state.view !== "list") params.set("view", state.view)
    const query = params.toString()
    history.replaceState(
      history.state,
      "",
      (query ? `?${query}` : location.pathname) + location.hash,
    )
  }

  function loadFromUrl() {
    const params = new URLSearchParams(location.search)
    for (const el of Array.from(form.elements) as HTMLInputElement[]) {
      if (!el.name) continue
      if (el.type === "checkbox") {
        el.checked =
          el.name === "discipline"
            ? params.getAll("discipline").includes(el.value)
            : params.get(el.name) === "on"
      } else if (params.has(el.name)) {
        el.value = params.get(el.name)!
      }
    }
    state.tab = params.get("tab") === "mine" ? "mine" : "all"
    state.view = params.get("view") === "map" ? "map" : "list"
    const extra = form.querySelectorAll<HTMLInputElement>(".races-more-filters [name]")
    if ([...extra].some((el) => (el.type === "checkbox" ? el.checked : el.value))) {
      form.querySelector("details")!.open = true
    }
  }

  function setActive(attr: "tab" | "view", value: string) {
    for (const b of root.querySelectorAll<HTMLElement>(`[data-${attr}]`)) {
      b.classList.toggle("active", b.dataset[attr] === value)
    }
  }

  function start() {
    const country = form.elements.namedItem("country") as HTMLSelectElement
    const codes = [...new Set(data.events.map((e) => e.country).filter(Boolean) as string[])]
    codes
      .map((code) => [code, countryName(code)] as const)
      .sort((a, b) => a[1].localeCompare(b[1], lang))
      .forEach(([code, name]) => country.add(new Option(`${flag(code)} ${name}`, code)))
    loadFromUrl()
    setActive("tab", state.tab)
    setActive("view", state.view)

    on(form, "input", apply)
    on(form, "submit", (ev) => ev.preventDefault())
    on(form, "reset", () => setTimeout(apply, 0))
    on(more, "click", () => {
      state.shown += PAGE
      renderList()
    })
    for (const b of root.querySelectorAll<HTMLElement>("[data-tab]")) {
      on(b, "click", () => {
        state.tab = b.dataset.tab!
        setActive("tab", state.tab)
        apply()
      })
    }
    for (const b of root.querySelectorAll<HTMLElement>("[data-view]")) {
      on(b, "click", () => {
        state.view = b.dataset.view!
        setActive("view", state.view)
        saveToUrl()
        render()
      })
    }
    root.classList.add("is-live")
    apply()
  }

  summary.textContent = ui.loading
  feedRequest ??= fetch(root.dataset.feed!, { cache: "no-cache" }).then((resp) => {
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return resp.json()
  })
  feedRequest.then(
    (feed) => {
      if (!alive) return
      data = feed
      start()
    },
    (err) => {
      feedRequest = undefined
      // The server-rendered list of races near home stays in place.
      if (alive) summary.textContent = `${ui.failed}: ${err.message}`
    },
  )

  return () => cleanups.forEach((fn) => fn())
}

document.addEventListener("nav", () => {
  for (const root of document.querySelectorAll<HTMLElement>(".races[data-feed]")) {
    window.addCleanup(mount(root))
  }
})
