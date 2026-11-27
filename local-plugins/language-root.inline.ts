import { preferredLanguage } from "./language-choice"

// The site root only picks a language. This runs in the head, before the root page is drawn,
// so the reader never sees it; without scripts the page stays and offers both languages.
if (/^\/(index(\.html)?)?$/.test(location.pathname)) {
  document.documentElement.style.visibility = "hidden"
  location.replace(`/${preferredLanguage()}/${location.search}${location.hash}`)
}
