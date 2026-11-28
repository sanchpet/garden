#!/usr/bin/env bash
# Regenerates everything in brand/out from the sources in brand/src.
set -euo pipefail
cd "$(dirname "$0")"
run() { uv run -q --with resvg-py --with pillow python "$@"; }
run src/gen_icon.py out
run src/rasterize.py out
run src/gen_og.py out "fonts/Caveat[wght].ttf" 600
run src/gen_avatar.py out
# The site's handwriting: Caveat cut down to Latin and Cyrillic.
uv run -q --with fonttools --with brotli pyftsubset "fonts/Caveat[wght].ttf" \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0400-045F,U+2010-2026,U+00AB,U+00BB" \
  --flavor=woff2 --output-file=out/caveat.woff2
# The hand of the annotations: Neucha, printed letters, cut down the same way. Its hinting and the
# device metrics that serve it go too, half the file: the other faces ship unhinted already.
uv run -q --with fonttools --with brotli pyftsubset "fonts/Neucha.ttf" \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0400-045F,U+2010-2026,U+00AB,U+00BB" \
  --no-hinting --drop-tables+=hdmx,VDMX \
  --flavor=woff2 --output-file=out/neucha.woff2
# The text face: fontsource's Literata subsets cut to weights 400-700 and optical sizes from 12,
# the range the site sets. Needs `npm ci` first.
uv run -q --with fonttools --with brotli python src/crop_weight.py out/fonts \
  ../node_modules/@fontsource-variable/literata/files/literata-{latin,latin-ext,cyrillic,cyrillic-ext}-opsz-{normal,italic}.woff2
