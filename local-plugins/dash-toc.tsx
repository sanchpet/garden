import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { FullSlug } from "../quartz/util/path"
import { dashPath, dashWidth, hasContents, type TocEntry } from "./dash-toc-logic"
// @ts-ignore
import script from "./dash-toc.inline"
import { languageOf, type Language } from "./languages"

const LABEL: Record<Language, string> = { ru: "Оглавление", en: "Contents" }

// The note's contents as pencil dashes in the margin left of the text, after Aaron Pham's
// garden (aarnphm.xyz): a heading's name shows beside its dash under the pointer or focus.
// Under the pointer or focus the strokes swell like a dock (dash-toc.inline.ts). The margin
// exists above 1200px; at 1200 the tablet layout still holds, so the dashes go there too.
export const DashToc = (() => {
  const Toc: QuartzComponent = ({ fileData }) => {
    const toc = fileData.toc as TocEntry[] | undefined
    if (!hasContents(toc)) return null
    const lang = languageOf(fileData.slug as FullSlug) ?? "en"
    return (
      <nav class="dash-toc" aria-label={LABEL[lang]}>
        <ol>
          {toc.map((entry, i) => {
            const width = dashWidth(entry.depth)
            return (
              <li>
                <a href={`#${entry.slug}`} data-slug={entry.slug} data-depth={entry.depth}>
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
/* No scroll box of its own: it would clip the names that show to the left of the dashes. */
nav.dash-toc {
  align-self: flex-end;
  margin: clamp(3rem, 20vh, 11rem) -0.9rem 0 0;
}
nav.dash-toc ol {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
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
  justify-content: flex-end;
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
nav.dash-toc .dash-label {
  position: absolute;
  right: calc(max(100%, var(--len, 0px)) + 0.6rem);
  top: 50%;
  width: max-content;
  max-width: 10rem;
  text-align: right;
  text-wrap: balance;
  font-size: 0.95rem;
  font-weight: 400;
  line-height: 1.3;
  color: var(--dark);
  background: var(--light);
  opacity: 0;
  pointer-events: none;
  transform: translate(0.3rem, -50%);
  transition: opacity 140ms ease-out, transform 160ms cubic-bezier(0.2, 0, 0, 1);
}
nav.dash-toc:not(.docked) a:is(:hover, :focus-visible) .dash-label,
nav.dash-toc.docked a.near .dash-label {
  opacity: 1;
  transform: translate(0, -50%);
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
