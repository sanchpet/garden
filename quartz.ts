import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { GardenFrontmatter, ObsidianOnlyBlocks, StripPrivateLinks } from "./local-plugins/garden"
import {
  LanguageLinks,
  LanguageSwitch,
  LegacyRedirects,
  PageLanguage,
} from "./local-plugins/bilingual"
import { GardenStyles } from "./local-plugins/garden-styles"
import { InlineDrawings } from "./local-plugins/drawing"
import { GardenBrand, HomeLogo } from "./local-plugins/brand"
import { SiteFontFaces, SiteFonts } from "./local-plugins/fonts"
import { ContentCards } from "./local-plugins/cards"
import { Thumbnails } from "./local-plugins/thumbs"
import { LoneDollars } from "./local-plugins/dollars"
import { VaultPaths } from "./local-plugins/vault-paths"
import { FootnoteLinks, FootnoteTooltip } from "./local-plugins/footnotes"
import { NoteHeader } from "./local-plugins/note-header"
import { ViewCount } from "./local-plugins/views"
import { SiteFooter } from "./local-plugins/site-footer"
import { DrawnCursor } from "./local-plugins/cursor"
import { CoverImage, NoteCover } from "./local-plugins/cover"
import { Series, SeriesLinks } from "./local-plugins/series"
import { PublicationFeed } from "./local-plugins/feed"
import { BookcaseScript } from "./local-plugins/bookcase"
import "./local-plugins/shelves"
import "./local-plugins/radar"
import { RaceCalendar, RacesFeed } from "./local-plugins/races"
import { Stream, StreamLink } from "./local-plugins/stream"
import {
  ContentProblems,
  FrontmatterLinks,
  SourceList,
  SourceTextsInPlace,
  withoutSourceTexts,
} from "./local-plugins/sources"
import { PageTypeDispatcher } from "./quartz/plugins/pageTypes/dispatcher"

const config = await loadQuartzConfig()
// Appended last: they read what the core transformers have already resolved,
// and links must find their language before unpublished ones are stripped.
// First, before the table of contents collects headings that are about to go.
config.plugins.transformers.unshift(ObsidianOnlyBlocks())
config.plugins.transformers.unshift(SourceTextsInPlace())
config.plugins.transformers.unshift(LoneDollars(), VaultPaths())
config.plugins.transformers.push(
  InlineDrawings(),
  PageLanguage(),
  GardenFrontmatter(),
  FrontmatterLinks(),
  SeriesLinks(),
  LanguageLinks(),
  StripPrivateLinks(),
  FootnoteLinks(),
  CoverImage(),
)

// The config loader builds the page dispatcher from the YAML layout, so a local component
// has to go into a fresh layout and a dispatcher rebuilt from it. Per-page-type layouts
// are full copies, hence our components go into each of them.
export const layout = await loadQuartzLayout()
const header = [
  SiteFontFaces(),
  HomeLogo(),
  StreamLink(),
  LanguageSwitch(),
  GardenStyles(),
  BookcaseScript(),
  FootnoteTooltip(),
]
const noteHeader = NoteHeader()
const cover = NoteCover()
const races = RaceCalendar()
const series = Series()
const sources = SourceList()
const stream = Stream()
// Its script counts every page, so it sits in every layout even where it draws nothing.
const views = ViewCount()
const cursor = DrawnCursor()
const siteFooter = SiteFooter()
let wrapped = 0
for (const pageLayout of [layout.defaults, ...Object.values(layout.byPageType)]) {
  pageLayout.header = [...(pageLayout.header ?? []), ...header]
  // The Properties table and content-meta are off in the YAML, so the end of beforeBody is under the title.
  pageLayout.beforeBody = [cover, ...(pageLayout.beforeBody ?? []), noteHeader]
  pageLayout.afterBody = [
    races,
    stream,
    series,
    sources,
    views,
    ...(pageLayout.afterBody ?? []),
    siteFooter,
  ]
  pageLayout.footer = [...(pageLayout.footer ?? []), cursor]
  pageLayout.right = pageLayout.right?.map((component) => {
    if (component.name !== "Backlinks") return component
    wrapped++
    return withoutSourceTexts(component)
  })
}
if (wrapped === 0) {
  throw new Error(
    "garden: no Backlinks component in any layout to wrap; a source card would list its texts twice",
  )
}
config.plugins.emitters.push(
  LegacyRedirects(),
  GardenBrand(),
  SiteFonts(),
  ContentCards(),
  Thumbnails(),
  RacesFeed(),
  PublicationFeed(),
  ContentProblems(),
)
const dispatcher = config.plugins.emitters.findIndex((e) => e.name === "PageTypeDispatcher")
config.plugins.emitters[dispatcher] = PageTypeDispatcher(layout)

export default config
