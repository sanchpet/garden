"""1200x630 social cards (RU, EN) on deep steel blue.

Usage: gen_og.py OUT_DIR FONT_TTF [WEIGHT]; reads OUT_DIR/valve.svg.
"""
import io, sys, random, pathlib
import resvg_py
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ICON = pathlib.Path(sys.argv[1])
FONT = sys.argv[2]
WEIGHT = int(sys.argv[3]) if len(sys.argv) > 3 else 0
W, H = 1200, 630
BLUE = (30, 57, 89)        # #1E3959
BLUE_LIT = (44, 78, 116)   # glow behind the valve
BLUE_EDGE = (19, 37, 60)   # vignette
CREAM = (245, 236, 220)
MUTED = (184, 200, 218)
VALVE = 330
VX = 445                   # valve centre: keeps it inside a centred 630x630 crop


def render(svg, px):
    return Image.open(io.BytesIO(bytes(resvg_py.svg_to_bytes(svg_path=str(svg), width=px, height=px)))).convert("RGBA")


def font(size):
    ft = ImageFont.truetype(FONT, size)
    if WEIGHT:
        ft.set_variation_by_axes([WEIGHT])
    return ft


def background():
    yy, xx = H / 2, VX
    grad = Image.new("L", (W, H))
    px = grad.load()
    for y in range(H):
        for x in range(W):
            d = (((x - xx) / 620) ** 2 + ((y - yy) / 420) ** 2) ** 0.5
            px[x, y] = int(max(0.0, min(1.0, d)) * 255)
    lit = Image.new("RGB", (W, H), BLUE_LIT)
    mid = Image.new("RGB", (W, H), BLUE)
    edge = Image.new("RGB", (W, H), BLUE_EDGE)
    im = Image.composite(mid, lit, grad.point(lambda v: min(255, v * 2)))
    im = Image.composite(edge, im, grad.point(lambda v: max(0, (v - 150) * 2)))
    rnd = random.Random(5)
    noise = Image.new("L", (W // 2, H // 2))
    noise.putdata([rnd.randint(0, 255) for _ in range(noise.width * noise.height)])
    noise = noise.resize((W, H), Image.BICUBIC)
    grain = Image.new("RGB", (W, H), (60, 92, 128))
    return Image.composite(grain, im, noise.point(lambda v: int(max(0, v - 140) * 0.22)))


def shadow(icon, blur=16, alpha=110, dy=14):
    a = icon.getchannel("A").point(lambda v: v * alpha // 255)
    sh = Image.new("RGBA", icon.size, (6, 14, 26, 0))
    sh.putalpha(a)
    pad = blur * 3
    c = Image.new("RGBA", (icon.width + 2 * pad, icon.height + 2 * pad))
    c.alpha_composite(sh, (pad, pad + dy))
    return c.filter(ImageFilter.GaussianBlur(blur)), pad


def card(title, sub):
    im = background().convert("RGBA")
    icon = render(ICON / "valve.svg", VALVE)
    x, y = VX - VALVE // 2, (H - VALVE) // 2
    sh, pad = shadow(icon)
    im.alpha_composite(sh, (x - pad, y - pad))
    im.alpha_composite(icon, (x, y))

    tx = x + VALVE + 50
    avail = W - tx - 60
    size = 104
    while font(size).getlength(title) > avail:
        size -= 2
    ft, fs = font(size), font(int(size * 0.62))
    d = ImageDraw.Draw(im)
    base = H // 2 + int(size * 0.12)
    d.text((tx, base), title, font=ft, fill=CREAM, anchor="ls")
    d.text((tx + int(size * 0.9), base + int(size * 0.78)), sub, font=fs, fill=MUTED, anchor="ls")
    return im.convert("RGB")


ru = card("Учусь мыслить", "…и понимать")
en = card("Learning to think", "…and to understand")
ru.save(ICON / "og-image-ru.png", optimize=True)
en.save(ICON / "og-image-en.png", optimize=True)
