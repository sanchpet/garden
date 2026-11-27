import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import type { QuartzTransformerPlugin } from "../quartz/plugins/types"
import { FullSlug, resolveRelative } from "../quartz/util/path"
import { publishedPages } from "./garden"
import { languageOf } from "./languages"
import { seriesName, seriesOf } from "./series-index"
import { titleOnDisk } from "./sources"

const UI = {
  ru: { label: (name: string) => `Серия «${name}»`, previous: "раньше", next: "дальше" },
  en: { label: (name: string) => `Series “${name}”`, previous: "earlier", next: "next" },
}

// The other members count as the page's links, so the graph and their backlinks show the series.
// Runs after FrontmatterLinks, which sets the list this adds to.
export const SeriesLinks: QuartzTransformerPlugin = () => ({
  name: "SeriesLinks",
  markdownPlugins(ctx) {
    return [
      () => (_tree, file) => {
        const slug = file.data.slug!
        const others = seriesOf(publishedPages(ctx), slug).filter((member) => member !== slug)
        if (others.length === 0) return
        const data = file.data as { frontmatterLinks?: string[] }
        data.frontmatterLinks = [...new Set([...(data.frontmatterLinks ?? []), ...others])]
      },
    ]
  },
})

// At the end of a text in a series: every member in order, this one marked, and the way on.
export const Series = (() => {
  const Block: QuartzComponent = ({ fileData, ctx }) => {
    const slug = fileData.slug
    if (!slug) return null
    const pages = publishedPages(ctx)
    const members = seriesOf(pages, slug)
    if (members.length === 0) return null
    const ui = UI[languageOf(slug) === "en" ? "en" : "ru"]
    const at = members.indexOf(slug)
    const title = (member: string) => titleOnDisk(ctx, member) ?? member.split("/").pop()
    const link = (member: string) => (
      <a class="internal" href={resolveRelative(slug, member as FullSlug)}>
        {title(member)}
      </a>
    )
    const [previous, next] = [members[at - 1], members[at + 1]]

    return (
      <nav class="series" aria-labelledby="series-label">
        <h2 id="series-label">{ui.label(seriesName(pages.get(slug)!)!)}</h2>
        <ol>
          {members.map((member) =>
            member === slug ? (
              <li aria-current="page">
                <span class="series-here">{title(member)}</span>
              </li>
            ) : (
              <li>{link(member)}</li>
            ),
          )}
        </ol>
        {(previous || next) && (
          <p class="series-way">
            {previous && (
              <span class="series-previous">
                <span class="series-hand">{ui.previous}</span> {link(previous)}
              </span>
            )}
            {next && (
              <span class="series-next">
                <span class="series-hand">{ui.next}</span> {link(next)}
              </span>
            )}
          </p>
        )}
      </nav>
    )
  }

  Block.css = `
.series {
  margin: 0 0 1.5rem;
}
.series h2 {
  margin: 0 0 0.5rem;
}
.series ol {
  margin: 0;
  padding-left: 1.4rem;
}
.series li {
  margin: 0.25rem 0;
}
.series-here {
  display: inline-block;
  max-width: 100%;
  color: var(--dark);
  font-weight: 600;
}
.series-here::after {
  content: "";
  display: block;
  height: 6px;
  background: var(--darkgray);
  opacity: 0.6;
  -webkit-mask: var(--pencil-underline) center / 100% 100% no-repeat;
  mask: var(--pencil-underline) center / 100% 100% no-repeat;
}
.series-way {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  margin: 1rem 0 0;
}
.series-next {
  margin-left: auto;
  text-align: right;
}
@media (max-width: 800px) {
  .series-way {
    flex-direction: column;
  }
  .series-next {
    margin-left: 0;
    text-align: left;
  }
}
.series-hand {
  font-family: "Caveat", cursive;
  font-weight: 700;
  font-size: 1.15rem;
  line-height: 1;
  color: var(--gray);
}
`
  return Block
}) satisfies QuartzComponentConstructor
