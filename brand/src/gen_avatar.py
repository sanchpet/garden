"""640x640 Telegram avatar: the valve on the card's steel blue, sized to survive the round crop.

Usage: gen_avatar.py OUT_DIR; reads OUT_DIR/valve.svg.
"""
import io, sys, random, pathlib
import resvg_py
from PIL import Image, ImageFilter

OUT = pathlib.Path(sys.argv[1])
S = 640
VALVE = int(S * 0.80)
BLUE = (30, 57, 89)        # #1E3959, as on the link cards
BLUE_LIT = (44, 78, 116)
BLUE_EDGE = (19, 37, 60)


def background():
    c = S / 2
    grad = Image.new("L", (S, S))
    px = grad.load()
    for y in range(S):
        for x in range(S):
            d = (((x - c) / (S * 0.62)) ** 2 + ((y - c) / (S * 0.62)) ** 2) ** 0.5
            px[x, y] = int(max(0.0, min(1.0, d)) * 255)
    lit = Image.new("RGB", (S, S), BLUE_LIT)
    mid = Image.new("RGB", (S, S), BLUE)
    edge = Image.new("RGB", (S, S), BLUE_EDGE)
    im = Image.composite(mid, lit, grad.point(lambda v: min(255, v * 2)))
    im = Image.composite(edge, im, grad.point(lambda v: max(0, (v - 150) * 2)))
    rnd = random.Random(5)
    noise = Image.new("L", (S // 2, S // 2))
    noise.putdata([rnd.randint(0, 255) for _ in range(noise.width * noise.height)])
    noise = noise.resize((S, S), Image.BICUBIC)
    grain = Image.new("RGB", (S, S), (60, 92, 128))
    return Image.composite(grain, im, noise.point(lambda v: int(max(0, v - 140) * 0.22)))


def shadow(icon, blur=14, alpha=110, dy=12):
    a = icon.getchannel("A").point(lambda v: v * alpha // 255)
    sh = Image.new("RGBA", icon.size, (6, 14, 26, 0))
    sh.putalpha(a)
    pad = blur * 3
    c = Image.new("RGBA", (icon.width + 2 * pad, icon.height + 2 * pad))
    c.alpha_composite(sh, (pad, pad + dy))
    return c.filter(ImageFilter.GaussianBlur(blur)), pad


data = resvg_py.svg_to_bytes(svg_path=str(OUT / "valve.svg"), width=VALVE, height=VALVE)
icon = Image.open(io.BytesIO(bytes(data))).convert("RGBA")
im = background().convert("RGBA")
x = y = (S - VALVE) // 2
sh, pad = shadow(icon)
im.alpha_composite(sh, (x - pad, y - pad))
im.alpha_composite(icon, (x, y))
im.convert("RGB").save(OUT / "telegram-avatar.png", optimize=True)
