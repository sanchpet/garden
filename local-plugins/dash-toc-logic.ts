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

// The top level is the longest dash; each level down is shorter, down to a stub.
export function dashWidth(depth: number): number {
  return Math.max(8, 20 - 5 * Math.max(0, depth))
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
