import { selfHost } from "./self-host"

// npx tsx scripts/self-host/cli.ts public — after `quartz build`, before the site is published.
const out = process.argv[2] ?? "public"
const left = selfHost(out)
if (left.length) {
  console.error("The site still loads code or styles from a CDN:")
  for (const line of left) console.error(`- ${line}`)
  process.exit(1)
}
console.log(`Self-hosted: no CDN addresses left in ${out}.`)
