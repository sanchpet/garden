// Who owns a finger on the bookcase, decided by its first move. The case pans both ways, so a
// slanted drag is the case's; only a clearly vertical one is left to the page, to scroll past.
export const VERTICAL = 1.4

export function fingerOwner(dx: number, dy: number): "case" | "page" {
  return Math.abs(dy) > VERTICAL * Math.abs(dx) ? "page" : "case"
}
