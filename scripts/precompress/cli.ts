import { precompress } from "./precompress"

// npx tsx scripts/precompress/cli.ts public — the last step before the site is published.
const out = process.argv[2] ?? "public"
const { files, raw, compressed } = precompress(out)
const kb = (n: number) => `${Math.round(n / 1024)} KB`
console.log(`Brotli: ${files} files, ${kb(raw)} → ${kb(compressed)}.`)
