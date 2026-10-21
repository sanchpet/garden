# Brand

The garden's icon and social cards, with everything needed to change them.

## The mark

A red valve handwheel with an eye for a hub, drawn from the author's hand sketch (`sketch/valve-sketch.png`): opening one's sight and mind. It keeps the felt-tip character of the sketch, with a burgundy contour, shading and marker glints.

- `sketch/` — the original sketch and `valve-alt1.svg`, the first vector take the final drawing grew from.
- `src/gen_icon.py` — draws `valve.svg` and `valve-small.svg`. The drawing is seeded, so a run is reproducible; tweak the colours and `Drawing(...)` parameters at the top.
- `src/rasterize.py` — favicons, touch icon and the 512 px icon. The full drawing turns to mush at 16 px, so that size comes from `valve-small.svg`.
- `src/gen_og.py` — the 1200×630 link preview cards, Russian and English: deep steel blue `#1E3959`, the valve left of centre so that a square crop keeps it whole, title in Caveat.

Palette: marker red `#EC0E16`, shadow `#B3000E`, contour `#5E0611`, card blue `#1E3959`, title cream `#F5ECDC`.

## Rebuilding

```sh
brand/build.sh
```

It needs [uv](https://docs.astral.sh/uv/); Python dependencies are pulled per run. The outputs in `out/` are committed, and `local-plugins/brand.tsx` copies them into the site.

## Font

[Caveat](https://github.com/googlefonts/caveat), SIL Open Font License 1.1 (`fonts/OFL.txt`).
