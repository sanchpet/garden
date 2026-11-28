import type { Element, Root } from "hast"
import { EXIT, visit } from "unist-util-visit"
import type { QuartzTransformerPluginInstance } from "../quartz/plugins/types"
import type { QuartzPluginData } from "../quartz/plugins/vfile"

declare module "vfile" {
  interface DataMap {
    math: boolean
  }
}

export function hasMath(tree: Root): boolean {
  let found = false
  visit(tree, "element", (node: Element) => {
    const classes = node.properties?.className
    if (!Array.isArray(classes) || !classes.includes("katex")) return
    found = true
    return EXIT
  })
  return found
}

// JSON with the characters that could end a script or a JS string escaped. Slashes stay:
// the self-host step finds CDN addresses in scripts by their literal text.
const scriptLiteral = (value: unknown) =>
  JSON.stringify(value).replace(
    /[<>\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  )

// A script the router would not run: scripts in a head fetched by SPA navigation are inert.
// So the loader comes with every page and fetches the script once a page shows a formula.
export function loaderFor(srcs: string[]): string {
  return `document.addEventListener("nav",()=>{if(window.__mathScripts||!document.querySelector(".katex"))return;window.__mathScripts=1;for(const src of ${scriptLiteral(srcs)}){const s=document.createElement("script");s.src=src;s.dataset.persist="";document.head.appendChild(s)}})`
}

// The latex plugin declares KaTeX's stylesheet and copy script for every page, though few
// have a formula. The stylesheet moves into the head of the pages that render one (the SPA
// router swaps head links on navigation); the script is fetched on the first such page.
export function mathOnlyWhereUsed(
  latex: QuartzTransformerPluginInstance,
): QuartzTransformerPluginInstance {
  return {
    ...latex,
    htmlPlugins(ctx) {
      return [
        ...(latex.htmlPlugins?.(ctx) ?? []),
        () => (tree: Root, file) => {
          file.data.math = hasMath(tree)
        },
      ]
    },
    externalResources(ctx) {
      const own = latex.externalResources?.(ctx)
      const css = (own?.css ?? []).filter((r) => !r.inline)
      const srcs = (own?.js ?? []).flatMap((r) => (r.contentType === "external" ? [r.src] : []))
      if (css.length === 0 && srcs.length === 0) return own
      return {
        ...own,
        css: (own?.css ?? []).filter((r) => r.inline),
        js: [
          ...(own?.js ?? []).filter((r) => r.contentType !== "external"),
          ...(srcs.length > 0
            ? [
                {
                  script: loaderFor(srcs),
                  loadTime: "afterDOMReady" as const,
                  contentType: "inline" as const,
                },
              ]
            : []),
        ],
        additionalHead: [
          ...(own?.additionalHead ?? []),
          (page: QuartzPluginData) =>
            page.math ? (
              <>
                {css.map((r) => (
                  <link key={r.content} rel="stylesheet" href={r.content} />
                ))}
              </>
            ) : (
              <></>
            ),
        ],
      }
    },
  }
}
