"""Overrides that make a local fallback face take the room the web font will take.

Until a web font arrives the browser draws with a local face; when the two differ in width and
line height, the page reflows on the swap. Each fallback @font-face in local-plugins/fonts.ts
carries size-adjust (the width of the texts shaped in the web font, kerning included, over their
width in the fallback) and ascent/descent/line-gap overrides (the web font's, divided by
size-adjust, which scales them too).

Run on macOS, where the local faces are, after a change of fonts or a large change of the texts:
uv run --with fonttools --with brotli --with uharfbuzz python fallback_metrics.py <texts dir>
"""

import io
import json
import re
import sys
from pathlib import Path

import uharfbuzz as hb

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FONTS = Path(__file__).resolve().parent.parent / "out" / "fonts"
SUPPLEMENTAL = Path("/System/Library/Fonts/Supplemental")
PLEX = Path(__file__).resolve().parents[2] / "node_modules/@fontsource/ibm-plex-mono/files"

CYRILLIC = re.compile("[\u0400-\u045f]")
OTHER = re.compile("[^\u0400-\u045f]")


def text_of(md: str) -> str:
    md = re.sub(r"\A---\n.*?\n---\n", "", md, flags=re.S)
    md = re.sub(r"```.*?```|~~~.*?~~~", "", md, flags=re.S)
    md = re.sub(r"!?\[\[[^\]]*\]\]|\]\([^)]*\)|<[^>]+>", "", md)
    return re.sub(r"[#>*_`|\[\]]", "", md)


def corpus(root: Path, lang: str) -> str:
    text = " ".join(text_of(path.read_text()) for path in (root / lang).rglob("*.md"))
    return re.sub(r"\s+", " ", text)


def font(path: Path, **axes) -> TTFont:
    face = TTFont(path)
    if axes and "fvar" in face:
        face = instantiateVariableFont(face, axes)
    return face


def width(face: TTFont, text: str, script: re.Pattern) -> float:
    """Advance of the letters of `script` in `text` shaped with `face`, in ems."""
    data = io.BytesIO()
    face.flavor = None
    face.save(data)
    hb_font = hb.Font(hb.Face(data.getvalue()))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf, {"kern": True, "liga": True})
    total = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        if script.match(text[info.cluster]):
            total += pos.x_advance
    return total / face["head"].unitsPerEm


def overrides(web: TTFont, size: float) -> dict:
    upm = web["head"].unitsPerEm
    os2 = web["OS/2"]
    return {
        "size": round(size * 100, 2),
        "ascent": round(os2.sTypoAscender / upm / size * 100, 2),
        "descent": round(-os2.sTypoDescender / upm / size * 100, 2),
        "lineGap": round(os2.sTypoLineGap / upm / size * 100, 2),
    }


def main() -> None:
    texts = Path(sys.argv[1])
    en, ru = corpus(texts, "en"), corpus(texts, "ru")
    # Body text is set at about 18px and headings at 25-35px in weight 600: the optical sizes and
    # weights the browser will pick from the variable font for each.
    styles = {
        "normal": ("normal", {"wght": 400, "opsz": 18}, "Times New Roman.ttf"),
        "bold": ("normal", {"wght": 600, "opsz": 30}, "Times New Roman Bold.ttf"),
        "italic": ("italic", {"wght": 400, "opsz": 18}, "Times New Roman Italic.ttf"),
    }
    out: dict = {}
    for name, (style, axes, local) in styles.items():
        latin = font(FONTS / f"literata-latin-opsz-{style}.woff2", **axes)
        cyrillic = font(FONTS / f"literata-cyrillic-opsz-{style}.woff2", **axes)
        fallback = font(SUPPLEMENTAL / local)
        # The Latin face is fitted on the English texts whole.
        latin_size = width(latin, en, OTHER) / width(fallback, en, OTHER)
        # A Russian line takes its spaces and punctuation from the Latin face, so the Cyrillic
        # face is fitted to make up the rest of the line's width.
        ru_web = width(latin, ru, OTHER) + width(cyrillic, ru, CYRILLIC)
        cyrillic_size = (ru_web - latin_size * width(fallback, ru, OTHER)) / width(
            fallback, ru, CYRILLIC
        )
        out[f"literata-latin-{name}"] = overrides(latin, latin_size)
        out[f"literata-cyrillic-{name}"] = overrides(cyrillic, cyrillic_size)
    plex = font(PLEX / "ibm-plex-mono-latin-400-normal.woff2")
    courier = font(SUPPLEMENTAL / "Courier New.ttf")
    out["plex-mono"] = overrides(plex, width(plex, en, OTHER) / width(courier, en, OTHER))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
