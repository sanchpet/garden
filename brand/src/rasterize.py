"""Raster sizes of the valve for the site: icon, favicons, touch icon.

Usage: rasterize.py OUT_DIR; reads OUT_DIR/valve.svg and OUT_DIR/valve-small.svg.
"""
import io
import pathlib
import sys

import resvg_py
from PIL import Image

OUT = pathlib.Path(sys.argv[1])


def render(svg: str, px: int) -> Image.Image:
    data = resvg_py.svg_to_bytes(svg_path=str(OUT / svg), width=px, height=px)
    return Image.open(io.BytesIO(bytes(data))).convert("RGBA")


# The full drawing turns to mush at 16 px; that size comes from the simplified one.
sizes = {16: "valve-small.svg", 32: "valve.svg", 48: "valve.svg"}
icons = {px: render(svg, px) for px, svg in sizes.items()}
for px, im in icons.items():
    im.save(OUT / f"favicon-{px}.png", optimize=True)
icons[48].save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[icons[16], icons[32]])
render("valve.svg", 180).save(OUT / "apple-touch-icon.png", optimize=True)
render("valve.svg", 512).save(OUT / "icon.png", optimize=True)
