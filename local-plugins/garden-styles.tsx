import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"

// Renders nothing; it only carries the garden's own CSS into the page bundle.
export const GardenStyles = (() => {
  const Styles: QuartzComponent = () => null
  // A note marked `cssclasses: [home]` is a landing page: a single column of text, without
  // sidebars, breadcrumbs or the folder listing it gets as its folder's page.
  Styles.css = `
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

/* On mobile the left sidebar gave the page its top padding. */
@media (max-width: 800px) {
  .page:has(article.home) > #quartz-body .page-header {
    margin-top: 2rem;
  }
}

.page:has(article.home) > #quartz-body :is(
  .sidebar,
  .breadcrumb-container,
  .center > hr,
  .page-footer,
  article.home + .page-listing
) {
  display: none;
}
`
  return Styles
}) satisfies QuartzComponentConstructor
