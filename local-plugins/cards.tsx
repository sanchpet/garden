import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import type { QuartzEmitterPlugin } from "../quartz/plugins/types"
import { FilePath, joinSegments } from "../quartz/util/path"
import { withoutLanguage } from "./bookcase"
import { drawCard, type Card, type Image } from "./cards/draw"
import { coverOf } from "./cover"
import { blocksText, excerpt } from "./feed-atom"
import { isSource, isText } from "./kinds"
import { languageOf, type Language } from "./languages"
import { RING, RINGS, ringOf } from "./radar"
import { dayOf, formatDay } from "./stream-events"

const LABEL: Record<Language, Record<string, string>> = {
  ru: {
    post: "пост",
    evergreen: "вечнозелёная заметка",
    note: "заметка",
    book: "книга",
    course: "курс",
    guide: "гайд",
    platform: "площадка",
    radar: "на радаре",
  },
  en: {
    post: "post",
    evergreen: "evergreen note",
    note: "note",
    book: "book",
    course: "course",
    guide: "guide",
    platform: "platform",
    radar: "on the radar",
  },
}

type Data = { slug?: string; frontmatter?: Record<string, unknown>; cover?: string }

// Which pages get a card of their own. A text with a cover keeps the cover as its preview;
// a book's cover goes onto its card instead.
export function cardKind(data: Data): Card["kind"] | undefined {
  const fm = data.frontmatter ?? {}
  if (!languageOf(data.slug)) return undefined
  if (isSource(fm.type)) return "source"
  if (fm.type === "tool") return ringOf(fm.ring) ? "tool" : undefined
  if (isText(fm.type)) return coverOf(data) ? undefined : "text"
  return undefined
}

// JPEG: a card with a photographed cover is three times the size as PNG.
export const cardPath = (slug: string) => `static/cards/${slug}.jpg`

const plain = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : ""

async function embed(file: string, width: number): Promise<Image> {
  const { data, info } = await sharp(file)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true })
  return {
    href: `data:image/jpeg;base64,${data.toString("base64")}`,
    width: info.width,
    height: info.height,
  }
}

// A link preview card per text, source card and radar tool, drawn from the page (cards/draw.ts);
// local-plugins/brand.tsx names it in the page's og:image. Other pages keep the site-wide card.
export const ContentCards: QuartzEmitterPlugin = () => ({
  name: "ContentCards",
  async *emit(ctx, content) {
    const icon = await sharp(path.join("brand", "out", "icon.png"))
      .resize({ width: 144 })
      .png()
      .toBuffer()
    const mark = `data:image/png;base64,${icon.toString("base64")}`
    for (const [tree, file] of content) {
      if (!file.data.filePath?.endsWith(".md")) continue
      const data = file.data as Data
      const kind = cardKind(data)
      if (!kind) continue
      const slug = data.slug!
      const lang = languageOf(slug)!
      const fm = data.frontmatter ?? {}
      const type = plain(fm.type)
      const common = {
        mark,
        label: LABEL[lang][type] ?? "",
        title: plain(fm.title),
        description: plain(fm.description) || undefined,
      }
      let card: Card
      if (kind === "text") {
        const day = dayOf(fm.published ?? fm.created)
        card = {
          ...common,
          kind,
          // A note has no title: its opening words stand for one, as in the feed.
          title: type === "note" ? excerpt(blocksText(tree)) : common.title,
          foot: day ? formatDay(day, lang, "long") : undefined,
        }
      } else if (kind === "source") {
        const cover = coverOf(data)
        // The shelf is named in Russian only, as the card writes it.
        const shelf = lang === "ru" ? plain(fm.category) : ""
        card = {
          ...common,
          kind,
          label: [common.label, shelf].filter(Boolean).join(" · "),
          path: withoutLanguage(slug),
          author: [plain(fm.author), plain(fm.year)].filter(Boolean).join(", ") || undefined,
          cover: cover ? await embed(path.join(ctx.argv.directory, cover), 560) : undefined,
        }
      } else {
        const ring = ringOf(fm.ring)!
        card = {
          ...common,
          kind,
          label: `${LABEL[lang].radar} · ${RING[lang][ring].name}`,
          path: withoutLanguage(slug),
          ring: RINGS.indexOf(ring),
        }
      }
      const out = joinSegments(ctx.argv.output, cardPath(slug)) as FilePath
      await fs.promises.mkdir(path.dirname(out), { recursive: true })
      await sharp(Buffer.from(drawCard(card)))
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(out)
      yield out
    }
  },
  async *partialEmit() {},
})
