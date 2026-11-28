import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { FullSlug } from "../quartz/util/path"
import { dashPath, hasContents, restLengths, type TocEntry } from "./dash-toc-logic"
// @ts-ignore
import script from "./dash-toc.inline"
import { languageOf, type Language } from "./languages"

const LABEL: Record<Language, string> = { ru: "Оглавление", en: "Contents" }

// The note's contents as pencil dashes in the margin left of the text, after Aaron Pham's
// garden (aarnphm.xyz). Under the pointer or focus the strokes swell rightwards like a dock
// over a veil on the rest of the page, and the nearest heading's name stands beside them
// (dash-toc.inline.ts). The margin exists above 1200px; at 1200 the tablet layout still holds.
export const DashToc = (() => {
  const Toc: QuartzComponent = ({ fileData }) => {
    const toc = fileData.toc as TocEntry[] | undefined
    if (!hasContents(toc)) return null
    const lang = languageOf(fileData.slug as FullSlug) ?? "en"
    const lengths = restLengths(toc)
    return (
      <nav class="dash-toc" aria-label={LABEL[lang]}>
        <ol>
          {toc.map((entry, i) => {
            const width = lengths[i]
            return (
              <li>
                <a href={`#${entry.slug}`} data-slug={entry.slug}>
                  <span class="dash-label">{entry.text}</span>
                  <svg
                    class="dash"
                    width={width}
                    height="5"
                    viewBox={`0 0 ${width} 5`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d={dashPath(width, i)} vector-effect="non-scaling-stroke" />
                  </svg>
                </a>
              </li>
            )
          })}
        </ol>
      </nav>
    )
  }

  Toc.afterDOMLoaded = script
  Toc.css = `
@media (min-width: 1201px) {
  .page[data-frame="default"] > #quartz-body .sidebar.left:has(.dash-toc) {
    display: flex;
  }
}
/* No scroll box of its own: it would clip the names that stand beside the dashes. */
nav.dash-toc {
  align-self: flex-end;
  margin: clamp(3rem, 20vh, 11rem) -0.9rem 0 0;
}
/* While the dock is open the rest of the page sits under a veil: the ground at 60% and a light
   blur, so the eye goes to the strip. The veil takes no pointer, so moving between strokes
   never leaves the strip; the sidebar is lifted so nothing positioned elsewhere covers it. */
nav.dash-toc::before {
  content: "";
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--light) 60%, transparent);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 220ms cubic-bezier(0.2, 0, 0, 1),
    visibility 0s linear 220ms;
}
nav.dash-toc.docked::before {
  opacity: 1;
  visibility: visible;
  transition: opacity 220ms cubic-bezier(0.2, 0, 0, 1);
}
.sidebar.left:has(nav.dash-toc.docked) {
  z-index: 50;
}
nav.dash-toc ol {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 0;
  padding: 0.2rem 0.3rem;
  list-style: none;
}
nav.dash-toc li {
  margin: 0;
}
nav.dash-toc a {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 1.6rem;
  height: 0.75rem;
  color: var(--gray);
  text-decoration: none;
  background: none;
}
nav.dash-toc svg.dash {
  flex-shrink: 0;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  opacity: 0.55;
  transition: opacity 160ms ease-out;
}
/* While docked the script sets each stroke's length and opacity every frame. */
nav.dash-toc.docked svg.dash {
  transition: none;
}
nav.dash-toc a[aria-current="location"] {
  color: var(--dark);
}
nav.dash-toc a[aria-current="location"] svg.dash {
  opacity: 1;
  stroke-width: 2;
}
/* Without the script a stroke under the pointer or focus still lights up and names itself. */
nav.dash-toc:not(.docked) a:is(:hover, :focus-visible),
nav.dash-toc.docked a.near {
  color: var(--secondary);
}
nav.dash-toc:not(.docked) a:is(:hover, :focus-visible) svg.dash {
  opacity: 1;
}
/* The name stands right of the longest stroke, set like a heading, over the veiled page. */
nav.dash-toc .dash-label {
  position: absolute;
  left: calc(max(100%, var(--len, 0px)) + 0.9rem);
  top: 50%;
  width: max-content;
  max-width: var(--label-room, 30rem);
  text-wrap: balance;
  font-size: 1.65rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--dark);
  opacity: 0;
  pointer-events: none;
  transform: translate(-0.4rem, -50%);
  transition:
    opacity 140ms ease-out,
    transform 200ms cubic-bezier(0.2, 0, 0, 1);
}
/* With no veil (no script) the name needs the ground behind it to be read over the text. */
nav.dash-toc:not(.docked) .dash-label {
  font-size: 1.05rem;
  background: var(--light);
}
nav.dash-toc:not(.docked) a:is(:hover, :focus-visible) .dash-label,
nav.dash-toc.docked a.near .dash-label {
  opacity: 1;
  transform: translate(0, -50%);
}
/* Escape put the strip away: no name until the pointer or focus comes back to it anew. */
nav.dash-toc.dismissed:not(.docked) a:is(:hover, :focus-visible) .dash-label {
  opacity: 0;
}
/* Keyboard focus wins over a pointer resting elsewhere on the rail: one name at a time. */
nav.dash-toc:not(.docked):has(a:focus-visible) a:hover:not(:focus-visible) .dash-label {
  opacity: 0;
}
nav.dash-toc a:focus-visible {
  outline: 2px solid var(--secondary);
  outline-offset: 1px;
  border-radius: 2px;
}
@media (prefers-reduced-motion: reduce) {
  nav.dash-toc::before,
  nav.dash-toc.docked::before,
  nav.dash-toc svg.dash,
  nav.dash-toc .dash-label {
    transition: none;
  }
}
@media print {
  nav.dash-toc {
    display: none;
  }
}
`
  return Toc
}) satisfies QuartzComponentConstructor
