import { opensHere } from "./radar-click"

// A blip is an SVG link, whose href the SPA router cannot read (an SVGAnimatedString), so it
// would reload the page; a plain click on it goes through the router instead.
document.addEventListener("click", (event) => {
  if (!opensHere(event) || !(event.target instanceof Element)) return
  const link = event.target.closest("a.radar-blip")
  if (!(link instanceof SVGAElement)) return
  event.preventDefault()
  window.spaNavigate(new URL(link.href.baseVal, window.location.href))
})
