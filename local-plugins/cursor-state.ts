// The drawn cursor: what the pointer turns into over each part of the page, and when the
// page draws it at all. The DOM-free half, shared by the build and the page script.

export type CursorMode = "pencil" | "underline" | "bracket" | "marker" | "help" | "crosshair"

// What resolveCursor needs from an element: Element.closest, so tests can pass a stand-in.
export interface Closest {
  closest(selector: string): unknown
}

export interface Resolved<T> {
  mode: CursorMode
  // What the cursor attaches to: the link an underline follows, the block brackets frame.
  target: T | null
}

const PROSE = [
  "article :is(p, li, dd, dt, td, th, blockquote, figcaption, pre, h1, h2, h3, h4, h5, h6)",
  "h1.article-title",
  ".note-annotation",
].join(", ")
const FOOTNOTE = "a[data-footnote-ref]"
// Drawn objects that are links: the hand reaches for a marker there.
const DRAWN = [
  ".garden-drawing a",
  "a.radar-blip",
  "a.bookcase-book",
  "a.shelves-book",
  "a.races-bib",
].join(", ")
const ACTION = [
  "a[href]",
  "button:not(:disabled)",
  "summary",
  "select",
  "label[for]",
  "input:is([type='checkbox'], [type='radio'], [type='button'], [type='submit'], [type='reset'], [type='range'])",
  "[role='button']:not([aria-disabled='true'])",
  "[role='link']",
  "[role='tab']",
  "[role='option']",
  "[role='menuitem']",
].join(", ")
// A control that belongs to a row is framed with its row.
const BLOCK = ["li.section-li", ".races-row"].join(", ")
const SCOPE = ".radar-scope"
// The margin's contents dashes stand a few pixels apart; corners jumping from one to the next
// would hide the name the dash shows, so the pencil just points.
const QUIET = "nav.dash-toc a"

export function resolveCursor<T extends Closest>(target: T | null): Resolved<T> {
  if (!target) return { mode: "pencil", target: null }
  const at = (selector: string) => target.closest(selector) as T | null
  const footnote = at(FOOTNOTE)
  if (footnote) return { mode: "help", target: footnote }
  const drawn = at(DRAWN)
  if (drawn) return { mode: "marker", target: drawn }
  if (at(QUIET)) return { mode: "pencil", target: null }
  const action = at(ACTION)
  if (action) {
    if (at(PROSE) && action.closest("a[href]") === action)
      return { mode: "underline", target: action }
    return { mode: "bracket", target: at(BLOCK) ?? action }
  }
  if (at(SCOPE)) return { mode: "crosshair", target: null }
  return { mode: "pencil", target: null }
}

export interface Environment {
  finePointer: boolean
  reducedData: boolean
  forcedColors: boolean
}

// A drawn cursor needs a mouse; it is left out where it costs data or would defeat the
// reader's own high-contrast colours.
export function shouldDraw(env: Environment): boolean {
  return env.finePointer && !env.reducedData && !env.forcedColors
}
