import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"

// Renders nothing; it only carries the garden's own CSS into the page bundle.
export const GardenStyles = (() => {
  const Styles: QuartzComponent = () => null
  // The garden has no left sidebar; on desktop its empty column keeps the text centred.
  // A note marked `cssclasses: [home]` is a landing page: a single column of text, without
  // sidebars or the folder listing it gets as its folder's page.
  Styles.css = `
.page[data-frame="default"] > #quartz-body .sidebar.left {
  display: none;
}

/* .center has no grid area of its own and would flow into the freed first column. */
@media (min-width: 1200px) {
  .page[data-frame="default"] > #quartz-body > .center {
    grid-column: 2;
  }
}

@media (min-width: 800px) and (max-width: 1200px) {
  .page[data-frame="default"] > #quartz-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "grid-header"
      "grid-center"
      "grid-sidebar-right"
      "grid-footer";
  }
}

/* The theme toggle sits right of the language switch, at the top right of the page. */
.page-header header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}
.page-header header > .darkmode {
  order: 1;
}

/* A catalogue note is its folder's page; the folder listing under the table repeats it. */
article:has(.bases-page) + .page-listing {
  display: none;
}

/* A drawing inlined by InlineDrawings: column width on a wide screen, its own width
   with a horizontal scroll on a narrow one, where it would shrink past reading. */
@font-face {
  font-family: "Caveat";
  src: url("/static/caveat.woff2") format("woff2");
  font-weight: 400 700;
  font-display: swap;
}
@font-face {
  font-family: "Neucha";
  src: url("/static/neucha.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}
.garden-drawing {
  margin: 1.5rem 0;
  overflow-x: auto;
}
.garden-drawing > svg {
  display: block;
  width: 100%;
  min-width: var(--drawing-min, 720px);
  height: auto;
}
/* A tablet sketch keeps the size it was drawn at, so the handwriting matches the text. Its
   pencil is the theme's text colour; marker strokes keep their own colour in both themes. */
.garden-drawing > svg.garden-sketch {
  width: auto;
  max-width: 100%;
  margin-inline: auto;
}
.garden-sketch .sketch-pencil {
  fill: var(--darkgray);
}
.garden-drawing a {
  cursor: pointer;
}
.garden-drawing a:hover > :is(path, g > path),
.garden-drawing a:focus-visible > :is(path, g > path) {
  stroke-width: 4;
}
.garden-drawing a:hover text,
.garden-drawing a:focus-visible text {
  text-decoration: underline;
}

/* The title sits close under the header row with the logo. */
.page-header .article-title {
  margin-top: 0.75rem;
}

/* On mobile the left sidebar gave the page its top padding. */
@media (max-width: 800px) {
  .page[data-frame="default"] > #quartz-body .page-header {
    margin-top: 2rem;
  }
}

.page:has(article.home) > #quartz-body {
  max-width: 800px;
  margin: 0 auto;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  grid-template-areas:
    "grid-header"
    "grid-center"
    "grid-footer";
}

.page:has(article.home) > #quartz-body > .center {
  grid-column: auto;
}

.page:has(article.home) > #quartz-body :is(
  .sidebar,
  .center > hr,
  .page-footer,
  article.home + .page-listing
) {
  display: none;
}

/* The home page ends with a rule and a line of links written by hand: the ways further in. */
article.home hr:last-of-type {
  margin: 2.5rem 0 0.9rem !important;
}
article.home hr:last-of-type + p {
  margin: 0 !important;
}
article.home hr:last-of-type + p a {
  margin-right: 1.2rem;
  font-family: "Caveat", cursive !important;
  font-size: 1.7rem !important;
  font-weight: 700 !important;
  color: var(--darkgray) !important;
  background: none !important;
  text-decoration: none !important;
}
article.home hr:last-of-type + p a:hover {
  color: var(--dark) !important;
  text-decoration: underline !important;
  text-decoration-thickness: 1.5px !important;
  text-underline-offset: 0.2em !important;
}

/* The hand in the frame (DESIGN.md): pencil strokes for rules and underlines, handwriting for
   the labels of blocks. The strokes are seeded and baked, like the ones in the drawn modules;
   as masks they take the text colour, so pencil follows the theme.
   Component CSS sits in a cascade layer and the core's base rules do not, so an unlayered
   rule wins whatever the selector; the important flag is what reverses that here. */
:root {
  --pencil-rule: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 6' preserveAspectRatio='none'%3E%3Cpath d='M0.0 2.91 Q33.3 2.48 66.7 3.11 Q100.0 2.90 133.3 3.76 Q166.7 3.32 200.0 2.94 Q233.3 3.27 266.7 3.01 Q300.0 3.22 333.3 3.16 Q366.7 2.66 400.0 2.43 Q433.3 2.95 466.7 3.02 Q500.0 3.52 533.3 3.23 Q566.7 3.40 600.0 3.53' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E");
  --pencil-underline: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 6' preserveAspectRatio='none'%3E%3Cpath d='M0.0 3.85 Q13.3 3.51 26.7 3.90 Q40.0 3.84 53.3 3.78 Q66.7 3.21 80.0 2.17 Q93.3 1.67 106.7 3.18 Q120.0 3.44 133.3 2.85 Q146.7 2.75 160.0 3.06 Q173.3 3.08 186.7 2.26 Q200.0 2.54 213.3 2.38 Q226.7 2.21 240.0 2.89' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E");
  --pencil-side: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 300' preserveAspectRatio='none'%3E%3Cpath d='M3.33 0.0 Q3.53 16.7 2.26 33.3 Q2.37 50.0 3.21 66.7 Q2.98 83.3 3.62 100.0 Q3.48 116.7 3.60 133.3 Q3.86 150.0 3.03 166.7 Q2.97 183.3 3.24 200.0 Q3.73 216.7 2.76 233.3 Q3.27 250.0 3.05 266.7 Q3.42 283.3 2.29 300.0' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E");
  scrollbar-color: var(--gray) transparent;
}

::selection {
  background: color-mix(in srgb, #F2B705 55%, transparent) !important;
  color: inherit !important;
}
:focus-visible {
  outline: 2px solid var(--secondary) !important;
  outline-offset: 2px !important;
  border-radius: 3px !important;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 600 !important;
  text-wrap: balance !important;
}

hr {
  height: 6px !important;
  border: 0 !important;
  background: var(--darkgray) !important;
  opacity: 0.6 !important;
  -webkit-mask: var(--pencil-rule) center / 100% 100% no-repeat !important;
  mask: var(--pencil-rule) center / 100% 100% no-repeat !important;
}

/* The note's title is underlined by hand. Its own formatting context keeps the box, and the
   underline with it, beside a floated cover instead of running under it. */
.page-header .article-title {
  display: flow-root !important;
  width: fit-content !important;
  max-width: 100% !important;
}
.page-header .article-title::after {
  content: "" !important;
  display: block !important;
  height: 6px !important;
  margin-top: 0.15rem !important;
  background: var(--darkgray) !important;
  opacity: 0.7 !important;
  -webkit-mask: var(--pencil-underline) center / 100% 100% no-repeat !important;
  mask: var(--pencil-underline) center / 100% 100% no-repeat !important;
}

/* A quotation is the author's note in the margin: a pencil line down the side and a hand that
   prints its letters, because an annotation runs to paragraphs and the cursive of the labels
   is slow to read at that length. A callout keeps its typeset form. */
article blockquote {
  position: relative !important;
  border-left: 0 !important;
  padding-left: 1.25rem !important;
}
article blockquote:not(.callout),
article blockquote:not(.callout) :is(p, li) {
  font-family: "Neucha", "Caveat", cursive !important;
  font-weight: 400 !important;
  font-size: 1.35rem !important;
  line-height: 1.45 !important;
  letter-spacing: 0.01em !important;
}
article blockquote:not(.callout) p {
  margin: 0.7rem 0 !important;
}
article blockquote:not(.callout) code {
  font-size: 0.75em !important;
}

/* Emphasis in the text is coloured: italic and bold each have a marker of their own. A link
   keeps the link colour. */
:root {
  --italic-ink: #2f5d50;
  --bold-ink: #a4452c;
}
:root[saved-theme="dark"] {
  --italic-ink: #9cc3b8;
  --bold-ink: #eba58c;
}
article :is(em, i):not(a *, a) {
  color: var(--italic-ink) !important;
}
article :is(strong, b):not(a *, a) {
  color: var(--bold-ink) !important;
}
article blockquote::before {
  content: "" !important;
  position: absolute !important;
  inset: 0.15rem auto 0.15rem 0 !important;
  width: 6px !important;
  background: var(--darkgray) !important;
  opacity: 0.7 !important;
  -webkit-mask: var(--pencil-side) center / 100% 100% no-repeat !important;
  mask: var(--pencil-side) center / 100% 100% no-repeat !important;
}

/* Labels of blocks are written by hand: the right column's blocks, the lists under the text,
   the names of the note's fields. */
.sidebar :is(.graph, .backlinks) > h3,
.sidebar .toc .toc-header h3,
.sources h2,
.series h2,
section.footnotes > h2,
.note-header .note-meta dt {
  font-family: "Caveat", cursive !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  color: var(--dark) !important;
}
.sidebar :is(.graph, .backlinks) > h3,
.sidebar .toc .toc-header h3 {
  font-size: 1.45rem !important;
  line-height: 1.1 !important;
}
.sources h2,
.series h2,
section.footnotes > h2 {
  font-size: 1.7rem !important;
}
.note-header .note-meta dt {
  font-size: 1.15rem !important;
  line-height: 1 !important;
  color: var(--gray) !important;
}

/* A link in the text is underlined in pen; the stock wash behind internal links is dropped.
   The series under the text is read as part of it, so its links follow. */
article a,
article a.internal,
.series a.internal {
  background: none !important;
  padding: 0 !important;
  font-weight: 400 !important;
  text-decoration: underline !important;
  text-decoration-thickness: 1px !important;
  text-underline-offset: 0.18em !important;
  text-decoration-color: color-mix(in srgb, currentColor 45%, transparent) !important;
}
article a:hover,
.series a.internal:hover {
  text-decoration-color: currentColor !important;
}
/* A picture in a text is held to the screen: a portrait phone photo at column width is taller than it.
   A width set in the note (![[picture|220]]) is kept, and the cap does not stretch it out of shape. */
article p > img {
  display: block;
  max-width: 100%;
  max-height: min(70vh, 36rem);
  object-fit: contain;
  margin: 1rem auto;
}
article p > img:not([width]) {
  width: auto;
}
article a.internal.tag-link,
article a:has(> img),
article .garden-drawing a {
  text-decoration: none !important;
}

/* The contents list: an entry out of view is muted text, not faded text, so it stays legible. */
.sidebar .toc .toc-content li > a {
  font-weight: 400 !important;
  color: var(--gray) !important;
  opacity: 1 !important;
}
.sidebar .toc .toc-content li > a.in-view {
  color: var(--dark) !important;
}
.sidebar .backlinks a {
  font-weight: 400 !important;
}

/* The serif reads at a larger size than the grotesque it replaced, and it shortens the line. */
article {
  font-size: 1.125rem !important;
}
article p,
article li {
  line-height: 1.65 !important;
}
/* On a page that asks for it (indent: true), a paragraph that follows another starts with a
   red line, as in a book. */
article.red-line .markdown-preview-view > p + p:not(:has(> img)) {
  text-indent: 1.5em;
}

/* A post or an evergreen note opens with a drop cap, as a chapter does: the same Literata, which
   takes its display optical size at this height, in ink. The build marks the paragraph
   (DropCap); a browser without initial-letter shows the plain opening. Never in a preview. */
@supports (initial-letter: 3) or (-webkit-initial-letter: 3) {
  article .markdown-preview-view > p.dropcap::first-letter {
    -webkit-initial-letter: 3;
    initial-letter: 3;
    margin-right: 0.1em;
    color: var(--dark);
    font-weight: 400;
  }
  @media (max-width: 600px) {
    article .markdown-preview-view > p.dropcap::first-letter {
      -webkit-initial-letter: 2;
      initial-letter: 2;
    }
  }
  .popover article .markdown-preview-view > p.dropcap::first-letter {
    -webkit-initial-letter: normal;
    initial-letter: normal;
    margin-right: 0;
    color: inherit;
  }
}

/* Headings step up from the larger body: 1.125 → 1.3 → 1.6 → 2.2rem. */
.page-header .article-title {
  font-size: 2.2rem !important;
}
article h2 {
  font-size: 1.6rem !important;
}
article h3 {
  font-size: 1.3rem !important;
}
article :is(h4, h5, h6) {
  font-size: 1.125rem !important;
}

::placeholder {
  color: var(--gray) !important;
  opacity: 1 !important;
}
/* A language the note does not exist in is dimmed, and still readable. */
.language-switch a.missing {
  opacity: 0.7 !important;
}
`
  // The graph plugin fixes the radius of a node and has no setting for the opening zoom, so
  // larger nodes and names come from zooming in once the graph is up: d3-zoom reads the
  // factor from a wheel event. If the plugin changes, the graph just opens at its stock size.
  Styles.afterDOMLoaded = `
(() => {
  const ZOOM = { "graph-container": 1.9, "global-graph-container": 1.5 }
  const closer = (canvas) => {
    const box = canvas.parentElement
    const k = box && ZOOM[[...box.classList].find((name) => name in ZOOM)]
    if (!k || !canvas.isConnected) return
    const r = canvas.getBoundingClientRect()
    canvas.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -Math.log2(k) / 0.002,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    )
  }
  new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node instanceof HTMLCanvasElement && node.closest(".graph"))
          setTimeout(() => closer(node), 400)
  }).observe(document.body, { childList: true, subtree: true })
})()
`
  return Styles
}) satisfies QuartzComponentConstructor
