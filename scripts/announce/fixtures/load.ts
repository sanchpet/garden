import fs from "node:fs"
import { parseFeed, type FeedEntry } from "../feed"

export const FIXTURE_FEED = new URL("./feed.xml", import.meta.url).pathname

export function fixture(): FeedEntry[] {
  return parseFeed(fs.readFileSync(FIXTURE_FEED, "utf8")).entries
}
