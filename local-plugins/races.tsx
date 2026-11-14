import fs from "node:fs"
import path from "node:path"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzEmitterPlugin } from "../quartz/plugins/types"
import { FilePath, joinSegments } from "../quartz/util/path"
import { languageOf } from "./bilingual"
import { BURGUNDY, CREAM, FONT_FACE, MARK } from "./bookcase"
// @ts-ignore
import script from "./races.inline"

// The race calendar: a note with `type: races` gets the calendar under its text. The data is
// the feed of sanchpet/races (parsers, picks, regions), checked out next to the texts by the
// workflow; this file draws the owner's picks as bibs and the shell of the tool on the
// server, and races.inline.ts filters the feed in the browser.

const FEED = process.env.RACES_FEED ?? path.join("races-feed", "events.json")
const PUBLISHED = "static/races/events.json"
// Without a script the reader still gets the picks and the races near home.
const HOME_REGIONS = 2
const STATIC_ROWS = 60

type Lang = "ru" | "en"
type Distance = { km: number; climb_m?: number }
type Pick = { person: string; status: string; note?: string | null }
export type Race = {
  id: string
  name: string
  start_date: string
  end_date: string
  country?: string
  city?: string
  lat?: number
  lon?: number
  discipline: string
  distances: Distance[]
  sources: { source: string; url: string }[]
  registration?: { status: string; url?: string | null }
  picks?: Pick[]
}
type Feed = {
  generated_at?: string
  sources: Record<string, { status: string; count: number }>
  owner: string
  regions: { key: string; labels: Record<string, string>; countries: string[] }[]
  countries: Record<string, string>
  events: Race[]
}

const UI = {
  ru: {
    locale: "ru-RU",
    mine: "Мои старты",
    all: "Все старты",
    filters: "Фильтры",
    search: "Поиск",
    searchHint: "Название, город или страна",
    region: "Регион",
    anywhere: "Весь мир",
    country: "Страна",
    allCountries: "Все страны",
    from: "С",
    to: "По",
    discipline: "Дисциплина",
    disciplines: {
      trail: "трейл",
      road: "шоссе",
      ultra: "ультра",
      sky: "скайраннинг",
      other: "другое",
    },
    kmin: "От, км",
    kmax: "До, км",
    emin: "Набор от, м",
    emax: "Набор до, м",
    ultraOnly: "Только длиннее марафона",
    reset: "Сбросить",
    list: "Список",
    map: "Карта",
    loading: "Загружаю календарь…",
    failed: "Календарь не загрузился",
    count: "{n} из {total}",
    more: "Показать ещё ({n})",
    none: "Под эти фильтры ничего не попало.",
    noPicks: "Отмеченных стартов пока нет.",
    km: "км",
    m: "м",
    until: "по",
    nowhere: "Место неизвестно",
    ongoing: "идёт",
    registration: {
      open: "регистрация открыта",
      closed: "регистрация закрыта",
      upcoming: "регистрация скоро",
    },
    pick: { planned: "в планах", registered: "заявлен", done: "пробежал" },
    details: "Подробнее",
    listedBy: "Источник:",
    eventId: "id старта",
    mapFailed: "Библиотека карты не загрузилась, список работает.",
    noPosition: "{n} из {total} без известного места, они только в списке. Точность — до города.",
    updated: "Обновлено {when} UTC. Источники:",
    stale: "не обновился",
    about: "Об источниках",
    disclaimer:
      "Даты и дистанции взяты из источников и могут отставать от сайта организатора: перед регистрацией сверяйтесь с ним.",
    credits: "Места — GeoNames (CC BY 4.0), карта © участники OpenStreetMap.",
    nearHome: "Ближайшие старты рядом с домом",
    unavailable: "Календарь сейчас недоступен.",
    code: "Парсеры",
  },
  en: {
    locale: "en-GB",
    mine: "My races",
    all: "All races",
    filters: "Filters",
    search: "Search",
    searchHint: "Name, city or country",
    region: "Region",
    anywhere: "Anywhere",
    country: "Country",
    allCountries: "All countries",
    from: "From",
    to: "To",
    discipline: "Discipline",
    disciplines: { trail: "trail", road: "road", ultra: "ultra", sky: "sky", other: "other" },
    kmin: "Min km",
    kmax: "Max km",
    emin: "Min climb, m",
    emax: "Max climb, m",
    ultraOnly: "Longer than a marathon only",
    reset: "Reset",
    list: "List",
    map: "Map",
    loading: "Loading the calendar…",
    failed: "Could not load the calendar",
    count: "{n} of {total}",
    more: "Show more ({n})",
    none: "No races match these filters.",
    noPicks: "No picked races yet.",
    km: "km",
    m: "m",
    until: "to",
    nowhere: "Location unknown",
    ongoing: "under way",
    registration: {
      open: "registration open",
      closed: "registration closed",
      upcoming: "registration soon",
    },
    pick: { planned: "planned", registered: "registered", done: "done" },
    details: "Details",
    listedBy: "Listed by",
    eventId: "event id",
    mapFailed: "The map library failed to load; the list still works.",
    noPosition:
      "{n} of {total} races have no known position and are only in the list. Positions are approximate (town level).",
    updated: "Updated {when} UTC from",
    stale: "stale",
    about: "About the sources",
    disclaimer:
      "Dates and distances come from the listed sources and may lag the organiser's site: check there before you register.",
    credits: "Places are geocoded with GeoNames (CC BY 4.0); map © OpenStreetMap contributors.",
    nearHome: "Next races near home",
    unavailable: "The calendar is unavailable right now.",
    code: "Parsers",
  },
}
export type RacesUi = (typeof UI)["en"]

let cached: Feed | null | undefined
function loadFeed(): Feed | null {
  if (cached !== undefined) return cached
  if (!fs.existsSync(FEED)) {
    console.warn(`races: no feed at ${FEED}, the calendar page is built empty`)
    return (cached = null)
  }
  const feed = JSON.parse(fs.readFileSync(FEED, "utf-8")) as Feed
  // A truncated or reshaped feed must stop the build, not publish an empty calendar.
  const shaped =
    Array.isArray(feed.events) &&
    feed.events.length > 0 &&
    Array.isArray(feed.regions) &&
    feed.regions.every((r) => r.labels?.en)
  if (!shaped)
    throw new Error(`races: ${FEED} is not a feed (no events, or regions without labels)`)
  feed.events.sort((a, b) => a.start_date.localeCompare(b.start_date))
  return (cached = feed)
}

export const RacesFeed: QuartzEmitterPlugin = () => ({
  name: "RacesFeed",
  async *emit(ctx) {
    const feed = loadFeed()
    if (!feed) return
    const out = joinSegments(ctx.argv.output, PUBLISHED) as FilePath
    await fs.promises.mkdir(path.dirname(out), { recursive: true })
    await fs.promises.writeFile(out, JSON.stringify(feed))
    yield out
  },
  async *partialEmit() {},
})

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function fmt(iso: string, ui: RacesUi, opts: Intl.DateTimeFormatOptions): string {
  return utc(iso).toLocaleDateString(ui.locale, { timeZone: "UTC", ...opts })
}

function km(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function placeOf(race: Race, feed: Feed, lang: Lang): string {
  let country = race.country && (feed.countries[race.country] ?? race.country)
  try {
    country =
      (race.country && new Intl.DisplayNames([lang], { type: "region" }).of(race.country)) ||
      country
  } catch {}
  return [race.city, country].filter(Boolean).join(", ")
}

function linkOf(race: Race): string {
  return race.registration?.url || race.sources[0]?.url || "#"
}

function Bib({ race, feed, lang, ui }: { race: Race; feed: Feed; lang: Lang; ui: RacesUi }) {
  const pick = race.picks!.find((p) => p.person === feed.owner)!
  const longest = race.distances[race.distances.length - 1]
  const status = (ui.pick as Record<string, string>)[pick.status] ?? pick.status
  return (
    <li>
      <a
        class={`races-bib is-${pick.status}`}
        href={linkOf(race)}
        rel="noopener"
        data-router-ignore
      >
        <span class="races-bib-date">
          {fmt(race.start_date, ui, { day: "numeric", month: "long", year: "numeric" })}
        </span>
        <span class="races-bib-number">{longest ? km(longest.km) : "?"}</span>
        <span class="races-bib-unit">
          {ui.km}
          {longest?.climb_m ? ` ↑${longest.climb_m} ${ui.m}` : ""}
        </span>
        <span class="races-bib-name">{race.name}</span>
        <span class="races-bib-place">{placeOf(race, feed, lang)}</span>
        <span class="races-bib-status">{status}</span>
      </a>
      {pick.note && lang === "en" && <p class="races-bib-note">{pick.note}</p>}
    </li>
  )
}

function Row({ race, feed, lang, ui }: { race: Race; feed: Feed; lang: Lang; ui: RacesUi }) {
  return (
    <li class="races-row">
      <div class="races-when">
        {fmt(race.start_date, ui, { day: "numeric", month: "short" })}
        <small>{fmt(race.start_date, ui, { weekday: "short" })}</small>
      </div>
      <div class="races-what">
        <a class="races-name" href={linkOf(race)} rel="noopener" data-router-ignore>
          {race.name}
        </a>
        <div class="races-meta">
          <span>{placeOf(race, feed, lang) || ui.nowhere}</span>
          <span>
            {(ui.disciplines as Record<string, string>)[race.discipline] ?? race.discipline}
          </span>
          {race.distances.map((d) => (
            <span class="races-chip">
              {km(d.km)} {ui.km}
              {d.climb_m ? ` ↑${d.climb_m} ${ui.m}` : ""}
            </span>
          ))}
        </div>
      </div>
    </li>
  )
}

export const RaceCalendar = (() => {
  const Calendar: QuartzComponent = ({ fileData }) => {
    if ((fileData.frontmatter as Record<string, unknown> | undefined)?.type !== "races") return null
    const lang: Lang = languageOf(fileData.slug) === "en" ? "en" : "ru"
    const ui = UI[lang]
    const feed = loadFeed()
    if (!feed) return <p class="races-unavailable">{ui.unavailable}</p>

    const today = new Date().toISOString().slice(0, 10)
    const picked = feed.events.filter((e) => e.picks?.some((p) => p.person === feed.owner))
    const home = new Set(feed.regions.slice(0, HOME_REGIONS).flatMap((r) => r.countries))
    const near = feed.events
      .filter((e) => e.end_date >= today && e.country && home.has(e.country))
      .slice(0, STATIC_ROWS)
    const when = feed.generated_at
      ? new Date(feed.generated_at).toISOString().slice(0, 16).replace("T", " ")
      : "?"
    const disciplines = Object.entries(ui.disciplines)

    return (
      <section
        class="races"
        data-feed={`/${PUBLISHED}`}
        data-lang={lang}
        data-ui={JSON.stringify(ui)}
      >
        {picked.length > 0 && (
          <>
            <h2 class="races-heading">{ui.mine}</h2>
            <ul class="races-bibs">
              {picked.map((race) => (
                <Bib race={race} feed={feed} lang={lang} ui={ui} />
              ))}
            </ul>
          </>
        )}

        <div class="races-tool">
          <div class="races-bar">
            <div class="races-seg" role="group">
              <button type="button" data-tab="all" class="active">
                {ui.all}
              </button>
              <button type="button" data-tab="mine">
                {ui.mine} <span class="races-pill">{picked.length}</span>
              </button>
            </div>
            <div class="races-seg" role="group">
              <button type="button" data-view="list" class="active">
                {ui.list}
              </button>
              <button type="button" data-view="map">
                {ui.map}
              </button>
            </div>
          </div>

          <form class="races-form" autocomplete="off">
            <label class="races-field races-search">
              {ui.search}
              <input type="search" name="q" placeholder={ui.searchHint} />
            </label>
            <label class="races-field">
              {ui.region}
              <select name="region">
                <option value="">{ui.anywhere}</option>
                {feed.regions.map((r) => (
                  <option value={r.key}>{r.labels[lang] ?? r.labels.en}</option>
                ))}
              </select>
            </label>
            <label class="races-field">
              {ui.country}
              <select name="country">
                <option value="">{ui.allCountries}</option>
              </select>
            </label>
            <details class="races-more-filters">
              <summary>{ui.filters}</summary>
              <div class="races-grid">
                <label class="races-field">
                  {ui.from}
                  <input type="date" name="from" />
                </label>
                <label class="races-field">
                  {ui.to}
                  <input type="date" name="to" />
                </label>
                <label class="races-field">
                  {ui.kmin}
                  <input type="number" name="kmin" min="0" step="1" inputmode="numeric" />
                </label>
                <label class="races-field">
                  {ui.kmax}
                  <input type="number" name="kmax" min="0" step="1" inputmode="numeric" />
                </label>
                <label class="races-field">
                  {ui.emin}
                  <input type="number" name="emin" min="0" step="100" inputmode="numeric" />
                </label>
                <label class="races-field">
                  {ui.emax}
                  <input type="number" name="emax" min="0" step="100" inputmode="numeric" />
                </label>
              </div>
              <fieldset class="races-checks">
                <legend>{ui.discipline}</legend>
                {disciplines.map(([key, label]) => (
                  <label>
                    <input type="checkbox" name="discipline" value={key} /> {label}
                  </label>
                ))}
              </fieldset>
              <label class="races-check">
                <input type="checkbox" name="ultra" /> {ui.ultraOnly}
              </label>
              <button type="reset" class="races-reset">
                {ui.reset}
              </button>
            </details>
          </form>

          <p class="races-summary" aria-live="polite">
            {ui.nearHome}
          </p>
          <div class="races-map" hidden></div>
          <p class="races-map-note" hidden></p>
          <ol class="races-list">
            {near.map((race) => (
              <Row race={race} feed={feed} lang={lang} ui={ui} />
            ))}
          </ol>
          <button type="button" class="races-more" hidden></button>
        </div>

        <footer class="races-foot">
          <p>
            {ui.updated.replace("{when}", when)}{" "}
            {Object.entries(feed.sources)
              .map(([name, s]) => `${name} (${s.count}${s.status !== "ok" ? `, ${ui.stale}` : ""})`)
              .join(", ")}
            . <a href="https://github.com/sanchpet/races/blob/main/docs/sources.md">{ui.about}</a>
            {" · "}
            <a href="https://github.com/sanchpet/races">{ui.code}</a>
          </p>
          <p>
            {ui.disclaimer} {ui.credits}
          </p>
        </footer>
      </section>
    )
  }

  Calendar.afterDOMLoaded = script
  Calendar.css = `
${FONT_FACE}
.races {
  margin: 2rem 0;
}
.races-heading {
  margin: 0 0 0.75rem;
}
.races-bibs {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin: 0 0 2.5rem;
  padding: 0;
}
.races-bibs > li {
  flex: 0 1 15rem;
  margin: 0;
}
/* A race bib: paper pinned at four corners, the distance where the number would be. */
a.races-bib {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  column-gap: 0.4rem;
  padding: 0.9rem 1.1rem 0.8rem;
  border: 2px solid var(--darkgray);
  border-radius: 3px 5px 4px 6px;
  background:
    radial-gradient(circle at 0.55rem 0.55rem, var(--gray) 0 2px, transparent 2.5px),
    radial-gradient(circle at calc(100% - 0.55rem) 0.55rem, var(--gray) 0 2px, transparent 2.5px),
    radial-gradient(circle at 0.55rem calc(100% - 0.55rem), var(--gray) 0 2px, transparent 2.5px),
    radial-gradient(circle at calc(100% - 0.55rem) calc(100% - 0.55rem), var(--gray) 0 2px, transparent 2.5px),
    ${CREAM};
  color: #2b2b2b;
  font-weight: 400;
  text-decoration: none;
  transform: rotate(-0.8deg);
  transition: transform 0.15s ease-out;
}
.races-bibs > li:nth-child(even) a.races-bib {
  transform: rotate(0.7deg);
}
a.races-bib:hover,
a.races-bib:focus-visible {
  transform: rotate(0deg) scale(1.02);
  color: #2b2b2b;
}
a.races-bib.is-planned {
  border-style: dashed;
}
.races-bib > span {
  grid-column: 1 / -1;
}
.races-bib-date,
.races-bib-place {
  font-size: 0.8rem;
  color: #6b6459;
}
.races-bib > .races-bib-number {
  grid-column: 1;
  font-family: "Caveat", cursive;
  font-size: 4.2rem;
  font-weight: 700;
  line-height: 0.95;
  color: #2b2b2b;
}
.is-registered .races-bib-number,
.is-done .races-bib-number {
  color: ${MARK};
}
.races-bib > .races-bib-unit {
  grid-column: 2;
  font-family: "Caveat", cursive;
  font-size: 1.4rem;
}
.races-bib-name {
  font-family: "Caveat", cursive;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.1;
}
.races-bib > .races-bib-status {
  justify-self: start;
  margin-top: 0.45rem;
  padding: 0 0.5rem;
  border: 1.5px solid currentColor;
  border-radius: 999px;
  font-size: 0.75rem;
  color: #6b6459;
}
.is-registered .races-bib-status {
  color: ${MARK};
}
.is-done .races-bib-status {
  color: ${BURGUNDY};
  border-width: 2.5px;
  font-weight: 700;
  text-transform: uppercase;
  transform: rotate(-4deg);
}
.races p.races-bib-note {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  font-style: italic;
  color: var(--gray);
}

.races-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.races:not(.is-live) :is(.races-bar, .races-form) {
  display: none;
}
.races-seg {
  display: inline-flex;
  border: 1.5px solid var(--darkgray);
  border-radius: 6px;
  overflow: hidden;
}
.races-seg button {
  padding: 0.3rem 0.8rem;
  border: 0;
  background: transparent;
  color: var(--darkgray);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}
.races-seg button + button {
  border-left: 1.5px solid var(--darkgray);
}
.races-seg button.active {
  background: var(--darkgray);
  color: var(--light);
}
.races-pill {
  padding: 0 0.4rem;
  border-radius: 999px;
  background: ${MARK};
  color: ${CREAM};
  font-size: 0.75rem;
}
.races-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1.5px dashed var(--gray);
  border-radius: 6px;
}
.races-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.8rem;
  color: var(--gray);
}
.races-search,
.races-more-filters {
  grid-column: 1 / -1;
}
.races-field :is(input, select) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0.35rem 0.5rem;
  border: 0;
  border-bottom: 1.5px solid var(--darkgray);
  border-radius: 0;
  background: transparent;
  color: var(--dark);
  font: inherit;
  font-size: 0.95rem;
}
.races-field :is(input, select):focus-visible {
  outline: none;
  border-bottom-color: ${MARK};
}
.races-field select option {
  background: var(--light);
  color: var(--dark);
}
.races-more-filters > summary {
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--secondary);
}
.races-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 0.75rem 1rem;
  margin-top: 0.75rem;
}
.races-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0.9rem 0 0;
  padding: 0;
  border: 0;
  font-size: 0.9rem;
}
.races-checks legend {
  padding: 0;
  font-size: 0.8rem;
  color: var(--gray);
}
.races-check {
  display: block;
  margin-top: 0.6rem;
  font-size: 0.9rem;
}
.races :is(.races-checks, .races-check) input {
  accent-color: ${MARK};
}
.races-reset,
.races-more {
  border: 0;
  background: none;
  color: var(--secondary);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}
.races [hidden] {
  display: none;
}
.races-reset {
  margin-top: 0.6rem;
  padding: 0;
}
.races-more {
  display: block;
  margin: 1rem auto 0;
  padding: 0.4rem 1rem;
  border: 1.5px dashed var(--gray);
  border-radius: 6px;
}
.races p.races-summary {
  margin: 0 0 0.25rem;
  font-size: 0.85rem;
  color: var(--gray);
}

.races-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.races-list > li {
  margin: 0;
}
.races-month {
  margin-top: 1.75rem;
  padding-bottom: 0.1rem;
  border-bottom: 2px solid var(--darkgray);
  font-family: "Caveat", cursive;
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--dark);
}
.races-row {
  display: grid;
  grid-template-columns: 4.2rem 1fr;
  gap: 0.9rem;
  padding: 0.65rem 0;
  border-bottom: 1px dashed var(--lightgray);
}
.races-when {
  font-family: "Caveat", cursive;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--dark);
}
.races-when small {
  display: block;
  font-family: var(--bodyFont);
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--gray);
}
a.races-name {
  font-weight: 600;
}
.races-row.is-picked a.races-name::before {
  content: "★ ";
  color: ${MARK};
}
.races-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.6rem;
  margin-top: 0.15rem;
  font-size: 0.82rem;
  color: var(--gray);
}
.races-chip {
  padding: 0 0.45rem;
  border: 1px solid var(--gray);
  border-radius: 999px;
  color: var(--darkgray);
  white-space: nowrap;
}
.races-badge {
  padding: 0 0.45rem;
  border-radius: 999px;
  background: var(--highlight);
  color: var(--darkgray);
  white-space: nowrap;
}
.races-badge.is-pick,
.races-badge.is-ongoing {
  background: ${MARK};
  color: ${CREAM};
}
.races-row details {
  margin-top: 0.2rem;
  font-size: 0.78rem;
  color: var(--gray);
}
.races-row summary {
  cursor: pointer;
  width: fit-content;
}
.races-empty {
  padding: 1.5rem 0;
  font-style: italic;
  color: var(--gray);
}

.races-map {
  height: min(70vh, 34rem);
  margin: 0.5rem 0;
  border: 2px solid var(--darkgray);
  border-radius: 4px 6px 5px 7px;
  z-index: 0;
}
/* Tiles sit on the page like a pencil sketch; the dark theme inverts them. */
.races-map .leaflet-tile-pane {
  filter: grayscale(1) contrast(0.92) brightness(1.05);
}
[saved-theme="dark"] .races-map .leaflet-tile-pane {
  filter: grayscale(1) invert(1) contrast(0.8) brightness(1.5);
}
/* The site rounds and spaces images; tiles must meet edge to edge. */
.races-map img {
  margin: 0;
  border-radius: 0;
}
.races-map .leaflet-bar a {
  border-color: var(--gray);
  background: var(--light);
  color: var(--dark);
}
.races-map.leaflet-container {
  background: var(--light);
  font-family: var(--bodyFont);
}
.races-map .marker-cluster,
.races-map .marker-cluster div {
  background: none;
}
.races-map .marker-cluster div {
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  margin: 5px;
  border-radius: 50%;
  text-align: center;
  border: 2px solid #3a3a3a;
  background: ${CREAM};
  color: #2b2b2b;
  font-family: "Caveat", cursive;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 26px;
}
.races-dot {
  box-sizing: border-box;
  border: 2px solid #3a3a3a;
  border-radius: 50%;
  background: ${CREAM};
}
.races-star {
  color: ${MARK};
  font-size: 26px;
  line-height: 26px;
  text-align: center;
  text-shadow:
    0 0 2px ${BURGUNDY},
    0 0 1px ${BURGUNDY};
}
.races-map .leaflet-popup-content {
  margin: 0.6rem 0.8rem;
  font-size: 0.85rem;
  line-height: 1.4;
}
.races p.races-map-note,
.races-foot p,
.races p.races-unavailable {
  font-size: 0.78rem;
  color: var(--gray);
}
.races-foot {
  margin-top: 2rem;
}
.races-foot p {
  margin: 0 0 0.4rem;
}
@media (max-width: 480px) {
  .races-row {
    grid-template-columns: 3.4rem 1fr;
    gap: 0.6rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  a.races-bib {
    transition: none;
  }
}
`
  return Calendar
}) satisfies QuartzComponentConstructor
