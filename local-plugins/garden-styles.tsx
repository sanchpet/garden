import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"

// Renders nothing; it only carries the garden's own CSS into the page bundle.
export const GardenStyles = (() => {
  const Styles: QuartzComponent = () => null
  // A home note is also its folder's page; `cssclasses: [home]` drops the folder listing under it.
  Styles.css = `
article.home + .page-listing {
  display: none;
}
`
  return Styles
}) satisfies QuartzComponentConstructor
