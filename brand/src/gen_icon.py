"""Final valve icon: the marker-drawn wheel (alt1) with contour, shading, glints and an eye for a hub.

Writes valve.svg (full drawing) and valve-small.svg (simplified, for 16 px) into the directory given.
"""
import math, random, sys, pathlib

OUT = pathlib.Path(sys.argv[1])
MARK = "#EC0E16"   # felt-tip red; overlaps multiply darker
SHADE = "#B3000E"  # shadow side of the body
BURG = "#5E0611"   # contour
INK = "#141214"
GLINT = "#FFE3DC"


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


class Drawing:
    def __init__(self, seed=3, R=33.6, rot=-6, jitter=1.1, knob=9.6):
        self.c = (50, 49)
        self.rnd = random.Random(seed)
        rnd = random.Random(seed)
        self.pts = []
        for i in range(6):
            a = math.radians(-90 + 60 * i + rot)
            r = R + rnd.uniform(-jitter, jitter)
            da = math.radians(rnd.uniform(-jitter, jitter) * 0.6)
            self.pts.append((self.c[0] + r * math.cos(a + da), self.c[1] + r * math.sin(a + da)))
        self.knob_r = [knob + self.rnd.uniform(-0.5, 0.5) for _ in self.pts]

    def wobbly_line(self, a, b, n=4, amp=0.9):
        rnd = self.rnd
        (x0, y0), (x1, y1) = a, b
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        nx, ny = -dy / L, dx / L
        d = f"M{f(x0)} {f(y0)}"
        for i in range(1, n + 1):
            t = i / n
            o = rnd.uniform(-amp, amp) if i < n else 0
            mx = x0 + dx * (t - 0.5 / n) + nx * rnd.uniform(-amp, amp)
            my = y0 + dy * (t - 0.5 / n) + ny * rnd.uniform(-amp, amp)
            d += f" Q{f(mx)} {f(my)} {f(x0+dx*t+nx*o)} {f(y0+dy*t+ny*o)}"
        return d

    def blob(self, cx, cy, r, n=9, amp=0.7):
        rnd = self.rnd
        ps = []
        for i in range(n):
            a = 2 * math.pi * i / n
            rr = r + rnd.uniform(-amp, amp)
            ps.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        pm = ((ps[-1][0] + ps[0][0]) / 2, (ps[-1][1] + ps[0][1]) / 2)
        d = f"M{f(pm[0])} {f(pm[1])}"
        for i in range(n):
            p0, p1 = ps[i], ps[(i + 1) % n]
            d += f" Q{f(p0[0])} {f(p0[1])} {f((p0[0]+p1[0])/2)} {f((p0[1]+p1[1])/2)}"
        return d + " Z"

    def arc(self, cx, cy, r, a0, a1):
        x0, y0 = cx + r * math.cos(math.radians(a0)), cy + r * math.sin(math.radians(a0))
        x1, y1 = cx + r * math.cos(math.radians(a1)), cy + r * math.sin(math.radians(a1))
        return f"M{f(x0)} {f(y0)} A{f(r)} {f(r)} 0 0 1 {f(x1)} {f(y1)}"


def body_shapes(dr, rim_w=(8.2, 4.2), spoke_w=6.6, hub_r=15.4, double_rim=True):
    """(strokes, fills): the wheel's marker strokes and its filled blobs."""
    strokes, fills = [], []
    for i in range(6):
        a, b = dr.pts[i], dr.pts[(i + 1) % 6]
        strokes.append((dr.wobbly_line(a, b), rim_w[0]))
        if double_rim:
            strokes.append((dr.wobbly_line(a, b, amp=1.5), rim_w[1]))
    for p in dr.pts:
        strokes.append((dr.wobbly_line(dr.c, p, n=3), spoke_w))
    fills += [dr.blob(x, y, r) for (x, y), r in zip(dr.pts, dr.knob_r)]
    fills.append(dr.blob(*dr.c, hub_r, n=11, amp=0.5))
    return strokes, fills


def layer(strokes, fills, color, grow=0.0, blend=False, extra=""):
    mb = ' style="mix-blend-mode:multiply"' if blend else ""
    out = [
        f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{f(w+grow)}" stroke-linecap="round" stroke-linejoin="round"{mb}/>'
        for d, w in strokes
    ]
    sw = f' stroke="{color}" stroke-width="{f(grow)}" stroke-linejoin="round"' if grow > 0 else ""
    out += [f'<path d="{d}" fill="{color}"{sw}/>' for d in fills]
    return f'<g {extra}>\n      ' + "\n      ".join(out) + "\n    </g>"


def eye(dr, iris_r=11.2, detail=True):
    cx, cy = dr.c
    rnd = random.Random(21)
    rays = []
    if detail:
        for i in range(16):
            a = math.radians(i * 22.5 + rnd.uniform(-6, 6))
            r0, r1 = 4.6, iris_r - 2.0 - rnd.uniform(0, 1.4)
            rays.append(
                f'<path d="M{f(cx+r0*math.cos(a))} {f(cy+r0*math.sin(a))} L{f(cx+r1*math.cos(a))} {f(cy+r1*math.sin(a))}" />'
            )
    ring = dr.blob(cx, cy, iris_r + 0.4, n=10, amp=0.35)
    iris = dr.blob(cx, cy, iris_r - 2.2, n=9, amp=0.3)
    pupil = dr.blob(cx + 0.2, cy + 0.2, 3.9 if detail else 2.6, n=7, amp=0.25)
    s = [f'<path d="{ring}" fill="{INK}"/>', f'<path d="{iris}" fill="url(#iris)"/>']
    if detail:
        s.append(f'<g stroke="#4E6176" stroke-width=".8" stroke-linecap="round" opacity=".85">' + "".join(rays) + "</g>")
        s.append(f'<path d="{dr.arc(cx, cy, iris_r-3.1, 20, 160)}" fill="none" stroke="#3F5063" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>')
    s.append(f'<path d="{pupil}" fill="{INK}"/>')
    s.append(f'<circle cx="{f(cx-2.9)}" cy="{f(cy-3.2)}" r="{1.75 if detail else 1.7}" fill="#fff"/>')
    if detail:
        s.append(f'<circle cx="{f(cx+2.3)}" cy="{f(cy+2.1)}" r=".6" fill="#fff" opacity=".7"/>')
    return "\n  ".join(s)


def glints(dr):
    s = []
    for (x, y), r in zip(dr.pts, dr.knob_r):
        s.append(dr.arc(x, y, r * 0.56, 205, 250))
        s.append(f"M{f(x-r*0.18)} {f(y-r*0.62)} l.4 -.1")
    # one short stroke on each lit (upper-left) rim edge
    for i, (t0, t1) in zip((4, 5, 0), ((0.38, 0.6), (0.3, 0.44), (0.42, 0.55))):
        a, b = dr.pts[i], dr.pts[(i + 1) % 6]
        if True:
            x0, y0 = a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0
            x1, y1 = a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1
            s.append(f"M{f(x0-0.9)} {f(y0-1.4)} L{f(x1-0.9)} {f(y1-1.4)}")
    return "".join(f'<path d="{d}"/>' for d in s)


DEFS = '''<defs>
    <filter id="wob" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="turbulence" baseFrequency=".07" numOctaves="2" seed="9" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="wob2" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="turbulence" baseFrequency=".09" numOctaves="2" seed="2" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="marker" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="turbulence" baseFrequency=".07" numOctaves="2" seed="9" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.3" xChannelSelector="R" yChannelSelector="G" result="w"/>
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 .38  0 0 0 0 .36  2.6 0 0 0 -1.75" result="specks"/>
      <feComposite in="specks" in2="w" operator="in" result="tex"/>
      <feMerge><feMergeNode in="w"/><feMergeNode in="tex"/></feMerge>
    </filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.5"/>
    </filter>
    <radialGradient id="iris" cx=".42" cy=".4" r=".65">
      <stop offset="0" stop-color="#EEF2F6"/>
      <stop offset=".5" stop-color="#A9BACB"/>
      <stop offset="1" stop-color="#5F7389"/>
    </radialGradient>
  </defs>'''


def final():
    dr = Drawing()
    st, fl = body_shapes(dr)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <title>Valve handwheel</title>
  {DEFS}
  <g filter="url(#soft)" opacity=".38">
    {layer(st, fl, "#3A0008", extra='transform="translate(1.6 2.6)"')}
  </g>
  <g filter="url(#wob2)">
    {layer(st, fl, BURG, grow=3.2)}
  </g>
  <g filter="url(#wob)">
    {layer(st, fl, SHADE)}
  </g>
  <g filter="url(#marker)" style="isolation:isolate">
    {layer(st, fl, MARK, blend=True, extra='transform="translate(-.55 -.65)"')}
  </g>
  <g fill="none" stroke="{GLINT}" stroke-width="1.3" stroke-linecap="round" opacity=".75" filter="url(#wob)">
    {glints(dr)}
  </g>
  {eye(dr)}
</svg>
'''


def small():
    # 16 px: same drawing, no texture or wobble filters, single rim stroke, heavier contour
    dr = Drawing(R=35.2, rot=-2, jitter=0.4, knob=10.6)
    st, fl = body_shapes(dr, rim_w=(7.6, 0), spoke_w=5.6, hub_r=12.6, double_rim=False)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <title>Valve handwheel</title>
  {DEFS}
  {layer(st, fl, BURG, grow=3.0)}
  {layer(st, fl, MARK)}
  {eye(dr, iris_r=9.4, detail=False)}
</svg>
'''


OUT.mkdir(parents=True, exist_ok=True)
(OUT / "valve.svg").write_text(final())
(OUT / "valve-small.svg").write_text(small())
