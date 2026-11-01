import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"
// @ts-ignore
import script from "./footnote-tooltip.inline"

// Quartz's link popover would preview the whole page for a footnote mark; FootnoteTooltip
// shows the footnote alone instead.
export const FootnoteLinks: QuartzTransformerPlugin = () => ({
  name: "FootnoteLinks",
  htmlPlugins() {
    return [
      () => (tree: Root) => {
        visit(tree, "element", (node: Element) => {
          const props = node.properties
          if (node.tagName !== "a" || !props) return
          if ("dataFootnoteRef" in props || "dataFootnoteBackref" in props) {
            props.dataNoPopover = "true"
          }
        })
      },
    ]
  },
})

export const FootnoteTooltip = (() => {
  const Tooltip: QuartzComponent = () => null
  Tooltip.afterDOMLoaded = script
  Tooltip.css = `
section.footnotes {
  font-size: 0.85em;
}
/* The generated "Footnotes" heading is meant for screen readers only; Quartz has no sr-only rule. */
section.footnotes > .sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.footnote-tooltip {
  position: absolute;
  z-index: 1000;
  box-sizing: border-box;
  max-width: min(24rem, calc(100vw - 16px));
  padding: 0.6rem 0.8rem;
  font-family: var(--bodyFont);
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--darkgray);
  background: var(--light);
  border: 1px solid var(--lightgray);
  border-radius: 6px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
}
.footnote-tooltip > p {
  margin: 0;
}
.footnote-tooltip > p + p {
  margin-top: 0.5em;
}
`
  return Tooltip
}) satisfies QuartzComponentConstructor
