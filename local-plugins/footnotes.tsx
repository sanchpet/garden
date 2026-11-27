import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"
import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"
import { labelFootnotes } from "./footnote-list"
import { languageOf } from "./languages"
// @ts-ignore
import script from "./footnote-tooltip.inline"

// Quartz's link popover would preview the whole page for a footnote mark; FootnoteTooltip
// shows the footnote alone instead.
export const FootnoteLinks: QuartzTransformerPlugin = () => ({
  name: "FootnoteLinks",
  htmlPlugins() {
    return [
      () => (tree: Root, file) => {
        visit(tree, "element", (node: Element) => {
          const props = node.properties
          if (node.tagName !== "a" || !props) return
          if ("dataFootnoteRef" in props || "dataFootnoteBackref" in props) {
            props.dataNoPopover = "true"
          }
        })
        labelFootnotes(tree, languageOf(file.data.slug))
      },
    ]
  },
})
export const FootnoteTooltip = (() => {
  const Tooltip: QuartzComponent = () => null
  Tooltip.afterDOMLoaded = script
  Tooltip.css = `
/* A footnote mark is a tinted chip in the link colour: a bare superscript digit, underlined
   like every link, is lost in running text. sup keeps no line height so the line stays even.
   !important beats the pen underline every article link gets in garden-styles. */
article sup:has(> a[data-footnote-ref]) {
  line-height: 0;
}
article sup > a[data-footnote-ref] {
  display: inline-block;
  margin-left: 0.1em;
  padding: 0.15em 0.4em !important;
  border-radius: 0.35em;
  font-size: 0.85em;
  font-weight: 600 !important;
  line-height: 1;
  color: var(--secondary) !important;
  background: color-mix(in srgb, var(--secondary) 24%, transparent) !important;
  text-decoration: none !important;
  transition: background-color 0.15s, color 0.15s;
}
article sup > a[data-footnote-ref]:hover,
article sup > a[data-footnote-ref]:focus-visible {
  color: var(--light) !important;
  background: var(--secondary) !important;
}
section.footnotes {
  font-size: 0.85em;
}
section.footnotes > ol {
  padding-left: 1.4rem;
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
