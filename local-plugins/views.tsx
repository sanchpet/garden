import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { isText } from "./kinds"
// @ts-ignore
import script from "./analytics.inline"

// Under a post or an evergreen text: how many people opened it, filled in by the page script
// from the site's GoatCounter. Hidden until the number arrives, so a blocked request leaves no gap.
export const ViewCount = (() => {
  const Views: QuartzComponent = ({ fileData }) => {
    const type = fileData.frontmatter?.type
    if (!isText(type) || type === "note") return null
    return <p class="view-count" data-views hidden></p>
  }
  Views.afterDOMLoaded = script
  Views.css = `
.view-count {
  margin: 1rem 0 0;
  font-size: 0.8rem;
  color: var(--gray);
}
`
  return Views
}) satisfies QuartzComponentConstructor
