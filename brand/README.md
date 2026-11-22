# Brand

The garden's icon and social cards, with everything needed to change them.

## The mark

A red valve handwheel with an eye for a hub, drawn from the author's hand sketch (`sketch/valve-sketch.png`): opening one's sight and mind. It keeps the felt-tip character of the sketch, with a burgundy contour, shading and marker glints.

- `sketch/` — the original sketch and `valve-alt1.svg`, the first vector take the final drawing grew from.
- `src/gen_icon.py` — draws `valve.svg` and `valve-small.svg`. The drawing is seeded, so a run is reproducible; tweak the colours and `Drawing(...)` parameters at the top.
- `src/rasterize.py` — favicons, touch icon, the 512 px icon and the 88 px header logo. The full drawing turns to mush at 16 px, so that size comes from `valve-small.svg`.
- `src/gen_og.py` — the 1200×630 link preview cards, Russian and English: deep steel blue `#1E3959`, the valve left of centre so that a square crop keeps it whole, title in Caveat.
- `src/gen_avatar.py` — the 640×640 Telegram avatar: the valve on the cards' steel blue, small enough to stay whole inside the round crop. Not served by the site.

Palette: marker red `#EC0E16`, shadow `#B3000E`, contour `#5E0611`, card blue `#1E3959`, title cream `#F5ECDC`.

## Cards drawn per page

Texts, source cards (books, courses) and radar tools get a preview card of their own, drawn at build time by `local-plugins/cards.tsx` on the same ground and with the same mark: a text shows its title and description, a book stands with its cover, a tool is a dot in its ring of the radar scope. These are not kept in the repository; the build writes them to `static/cards/`. Text is set as outlines from the font files in `fonts/`, so the build needs no installed fonts.

## Rebuilding

```sh
brand/build.sh
```

It needs [uv](https://docs.astral.sh/uv/); Python dependencies are pulled per run. The outputs in `out/` are committed, and `local-plugins/brand.tsx` copies them into the site.

## Fonts

[Caveat](https://github.com/googlefonts/caveat), [Literata](https://github.com/googlefonts/literata) and Neucha (from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/neucha)), all under the SIL Open Font License 1.1 (`fonts/OFL.txt`, `fonts/OFL-Literata.txt`, `fonts/OFL-Neucha.txt`). Neucha is the hand of the annotations in the text. The Literata files are cut down to Latin and Cyrillic.
