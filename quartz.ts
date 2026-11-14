import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { GardenFrontmatter, StripPrivateLinks } from "./local-plugins/garden"
import {
  LanguageLinks,
  LanguageSwitch,
  LegacyRedirects,
  PageLanguage,
} from "./local-plugins/bilingual"
import { GardenStyles } from "./local-plugins/garden-styles"
import { GardenBrand, HomeLogo } from "./local-plugins/brand"
import { FootnoteLinks, FootnoteTooltip } from "./local-plugins/footnotes"
import { NoteHeader } from "./local-plugins/note-header"
import { CoverImage, NoteCover } from "./local-plugins/cover"
import { ShareStubs } from "./local-plugins/share"
import { BookcaseScript } from "./local-plugins/bookcase"
import "./local-plugins/shelves"
import "./local-plugins/radar"
import { RaceCalendar, RacesFeed } from "./local-plugins/races"
import { PageTypeDispatcher } from "./quartz/plugins/pageTypes/dispatcher"

const config = await loadQuartzConfig()
// Appended last: they read what the core transformers have already resolved,
// and links must find their language before unpublished ones are stripped.
config.plugins.transformers.push(
  PageLanguage(),
  GardenFrontmatter(),
  LanguageLinks(),
  StripPrivateLinks(),
  FootnoteLinks(),
  CoverImage(),
)

// The config loader builds the page dispatcher from the YAML layout, so a local component
// has to go into a fresh layout and a dispatcher rebuilt from it. Per-page-type layouts
// are full copies, hence our components go into each of them.
export const layout = await loadQuartzLayout()
const header = [HomeLogo(), LanguageSwitch(), GardenStyles(), BookcaseScript(), FootnoteTooltip()]
const noteHeader = NoteHeader()
const cover = NoteCover()
const races = RaceCalendar()
for (const pageLayout of [layout.defaults, ...Object.values(layout.byPageType)]) {
  pageLayout.header = [...(pageLayout.header ?? []), ...header]
  // The Properties table and content-meta are off in the YAML, so the end of beforeBody is under the title.
  pageLayout.beforeBody = [cover, ...(pageLayout.beforeBody ?? []), noteHeader]
  pageLayout.afterBody = [races, ...(pageLayout.afterBody ?? [])]
}
config.plugins.emitters.push(LegacyRedirects(), GardenBrand(), ShareStubs(), RacesFeed())
const dispatcher = config.plugins.emitters.findIndex((e) => e.name === "PageTypeDispatcher")
config.plugins.emitters[dispatcher] = PageTypeDispatcher(layout)

export default config
