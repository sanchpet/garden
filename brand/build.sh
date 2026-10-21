#!/usr/bin/env bash
# Regenerates everything in brand/out from the sources in brand/src.
set -euo pipefail
cd "$(dirname "$0")"
run() { uv run -q --with resvg-py --with pillow python "$@"; }
run src/gen_icon.py out
run src/rasterize.py out
run src/gen_og.py out "fonts/Caveat[wght].ttf" 600
