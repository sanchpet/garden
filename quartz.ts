import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { GardenFrontmatter, StripPrivateLinks } from "./local-plugins/garden"

const config = await loadQuartzConfig()
// Appended last: both read what the core transformers have already resolved.
config.plugins.transformers.push(GardenFrontmatter(), StripPrivateLinks())
export default config
export const layout = await loadQuartzLayout()
