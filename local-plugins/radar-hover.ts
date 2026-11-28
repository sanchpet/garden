export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface Spot {
  left: number
  top: number
  below: boolean
  tip: number
}

// How far the pointer stays from the chip's corners.
export const TIP = 12

// Where a blip's label goes: centred above the dot, below it when there is no room above,
// slid sideways to stay inside `frame`; `tip` is where its pointer sits along the chip.
export function labelSpot(dot: Box, size: { width: number; height: number }, frame: Box, gap = 8) {
  const middle = dot.left + dot.width / 2
  const above = dot.top - gap - size.height
  const below =
    above < frame.top && dot.top + dot.height + gap + size.height <= frame.top + frame.height
  const most = frame.left + frame.width - size.width
  const left = Math.max(frame.left, Math.min(middle - size.width / 2, most))
  return {
    left,
    top: below ? dot.top + dot.height + gap : above,
    below,
    tip: Math.max(TIP, Math.min(middle - left, size.width - TIP)),
  } satisfies Spot
}

// A finger has no hover: its first tap on a blip shows the label, a tap on the shown blip opens it.
export const tapOpens = (touch: boolean, shown: Element | null, blip: Element) =>
  !touch || shown === blip
