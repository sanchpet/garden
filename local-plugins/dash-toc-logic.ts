import { seeded, wobble } from "./hand"

// A note's contents drawn as a column of pencil dashes beside the text, one per heading.
export interface TocEntry {
  depth: number
  text: string
  slug: string
}

// One heading is no contents; two already say how the text is built.
export const MIN_ENTRIES = 2

export function hasContents(toc: readonly TocEntry[] | undefined): toc is TocEntry[] {
  return (toc?.length ?? 0) >= MIN_ENTRIES
}

// Every dash rests at one length: the dock is the only thing that draws them unequal, so a
// level shown by length would read as a dock frozen in place.
export const REST_LENGTH = 18

export function restLengths(toc: readonly TocEntry[]): number[] {
  return toc.map(() => REST_LENGTH)
}

// The dash as a baked pencil stroke, seeded by its place so every build draws it alike.
export function dashPath(width: number, index: number): string {
  const rnd = seeded(7919 * (index + 1))
  return wobble(rnd, [1, 2.5], [width - 1, 2.5], 0.7)
}

// The section being read: the last heading whose top has passed the reading line. Before the
// first heading nothing is current.
export function currentSection(tops: readonly number[], line: number): number {
  let current = -1
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] <= line) current = i
    else break
  }
  return current
}

// Where a heading must be to count as passed: a third down the screen, where the eye is once a
// heading has scrolled up past the top. At the end of the page the last sections can never
// reach that line, so there it drops to the bottom of the screen and they get their turn.
export function readingLine(viewport: number, scrolled: number, scrollable: number): number {
  return scrolled >= scrollable - 2 ? viewport : viewport / 3
}

// Under the pointer the strokes swell like a dock, after Aaron Pham's garden: each grows by a
// bell of its distance from the pointer, the nearest the most, the far ones barely.
export const DOCK = {
  // How much the stroke under the pointer grows: it reaches about seven times its rest.
  amp: 100,
  // The bell's width: two and a half strokes either side still lift noticeably.
  sigma: 30,
}

export function bell(distance: number, sigma: number = DOCK.sigma): number {
  return Math.exp(-(distance * distance) / (2 * sigma * sigma))
}

export function dockLengths(
  rests: readonly number[],
  centres: readonly number[],
  y: number,
  amp: number = DOCK.amp,
): number[] {
  return rests.map((rest, i) => rest + amp * bell(centres[i] - y))
}

// The stroke the pointer is on: the one whose centre is closest, the first of a tie.
export function nearestIndex(centres: readonly number[], y: number): number {
  let best = -1
  for (let i = 0; i < centres.length; i++) {
    if (best === -1 || Math.abs(centres[i] - y) < Math.abs(centres[best] - y)) best = i
  }
  return best
}

// Where the pointer keeps the dock open: the strip's height with a little slack, and from its
// left edge across the longest a stroke can grow, since the strokes grow rightwards from there.
export function dockZone(
  strip: { left: number; top: number; bottom: number },
  reach: number,
  slack: number = 16,
): { left: number; right: number; top: number; bottom: number } {
  return {
    left: strip.left - slack,
    right: strip.left + reach + slack,
    top: strip.top - 12,
    bottom: strip.bottom + 12,
  }
}

// The nearest stroke is full ink; the rest fade with distance down to a faint pencil.
export function dockOpacity(lift: number, nearest: boolean): number {
  return nearest ? 1 : 0.3 + 0.6 * lift
}
