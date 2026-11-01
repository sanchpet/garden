import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"

// Renders nothing; it only carries the garden's own CSS into the page bundle.
export const GardenStyles = (() => {
  const Styles: QuartzComponent = () => null
  // The garden has no left sidebar; on desktop its empty column keeps the text centred.
  // A note marked `cssclasses: [home]` is a landing page: a single column of text, without
  // sidebars, breadcrumbs or the folder listing it gets as its folder's page.
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
