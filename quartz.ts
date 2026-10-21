import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { GardenFrontmatter, StripPrivateLinks } from "./local-plugins/garden"
import {
  LanguageLinks,
  LanguageSwitch,
  LegacyRedirects,
  PageLanguage,
} from "./local-plugins/bilingual"
import { GardenStyles } from "./local-plugins/garden-styles"
import { GardenBrand } from "./local-plugins/brand"
import { PageTypeDispatcher } from "./quartz/plugins/pageTypes/dispatcher"

const config = await loadQuartzConfig()
// Appended last: they read what the core transformers have already resolved,
// and links must find their language before unpublished ones are stripped.
config.plugins.transformers.push(
  PageLanguage(),
  GardenFrontmatter(),
  LanguageLinks(),
  StripPrivateLinks(),
)

// The config loader builds the page dispatcher from the YAML layout, so a local component
// has to go into a fresh layout and a dispatcher rebuilt from it. Per-page-type layouts
// are full copies, hence our components go into each of them.
export const layout = await loadQuartzLayout()
const header = [LanguageSwitch(), GardenStyles()]
for (const pageLayout of [layout.defaults, ...Object.values(layout.byPageType)]) {
  pageLayout.header = [...(pageLayout.header ?? []), ...header]
}
config.plugins.emitters.push(LegacyRedirects(), GardenBrand())
const dispatcher = config.plugins.emitters.findIndex((e) => e.name === "PageTypeDispatcher")
config.plugins.emitters[dispatcher] = PageTypeDispatcher(layout)

export default config
