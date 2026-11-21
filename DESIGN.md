---
name: sanch.pet
description: A reading garden whose modules are drawn by hand
colors:
  marker-red: "#EC0E16"
  marker-shadow: "#B3000E"
  contour-burgundy: "#5E0611"
  steel-blue: "#1E3959"
  paper-cream: "#F5ECDC"
  page-edge: "#EFE6D4"
  ink: "#1B1A1C"
  ink-on-paper: "#2b2b2b"
  note-on-paper: "#6b6459"
  cover-forest: "#2F5D50"
  cover-brick: "#B8553A"
  cover-ochre: "#D9A441"
  cover-plum: "#5B3A5E"
  cover-sage: "#84A59D"
  cover-slate: "#284B63"
  cover-wine: "#8C2F39"
  band-paper: "#F3EAD8"
  band-sticker: "#F2B705"
  inherited-ground: "#faf8f8"
  inherited-rule: "#e5e5e5"
  inherited-muted: "#b8b8b8"
  inherited-text: "#4e4e4e"
  inherited-strong: "#2b2b2b"
  inherited-link: "#284b63"
  inherited-link-hover: "#84a59d"
  inherited-ground-dark: "#161618"
  inherited-rule-dark: "#393639"
  inherited-muted-dark: "#646464"
  inherited-text-dark: "#d4d4d4"
  inherited-strong-dark: "#ebebec"
  inherited-link-dark: "#7b97aa"
typography:
  hand:
    fontFamily: "Caveat, cursive"
    fontWeight: 700
  headline:
    fontFamily: "Schibsted Grotesk"
    fontSize: "2rem"
  title:
    fontFamily: "Schibsted Grotesk"
    fontSize: "1.4rem"
  body:
    fontFamily: "Source Sans Pro"
    fontSize: "1rem"
    lineHeight: "1.6rem"
  label:
    fontFamily: "Source Sans Pro"
    fontSize: "0.7rem"
    letterSpacing: "0.06em"
  code:
    fontFamily: "IBM Plex Mono"
    fontSize: "0.9rem"
rounded:
  tag: "3px"
  control: "4px"
  popover: "6px"
  pill: "999px"
  hand-cut: "3px 5px 4px 6px"
components:
  bib:
    backgroundColor: "{colors.paper-cream}"
    textColor: "{colors.ink-on-paper}"
    rounded: "{rounded.hand-cut}"
    padding: "0.9rem 1.1rem 0.8rem"
  language-option-active:
    backgroundColor: "{colors.inherited-link}"
    textColor: "{colors.inherited-ground}"
    rounded: "{rounded.control}"
    padding: "0.1rem 0.45rem"
  popover:
    backgroundColor: "{colors.inherited-ground}"
    textColor: "{colors.inherited-text}"
    rounded: "{rounded.popover}"
    padding: "0.6rem 0.8rem"
  tag:
    rounded: "{rounded.tag}"
    padding: "0 0.3rem"
---

# Design System: sanch.pet

## Overview

**Creative North Star: "The Engineer's Study, Drawn in a Workbook"**

The site is a workbook: printed text in a calm column, and next to it things drawn by hand. What is drawn is the furniture of a study. The library is a bookcase with nightstands beside it, the tech radar is an instrument with a round scope and a knob, the race calendar is a row of paper bibs pinned by their corners. Each is drawn the way an engineer sketches: a projection that is actually constructed, a contour, a label in handwriting. A drawing here explains or holds content; none is decoration.

Two states are recorded in this file. Today the hand lives only inside the drawn modules and inlined drawings, and everything else (header, navigation, headings, the reading column) is the stock Quartz theme. The direction is that the hand enters the frame too: section openers, the header, navigation. The reading column stays typeset in both states.

**Key Characteristics:**

- Text is typeset, objects are drawn. A module is an object from the study before it is a widget.
- Pencil for structure, marker for what carries meaning.
- Handwriting (Caveat) for anything written on a drawn object.
- Flat page. Depth comes from drawn projection, never from shadows on the page.
- The hand is reproducible: strokes are generated from a seed and baked into paths.

## Colors

Two palettes sit side by side: the brand's own, used by everything drawn, and the Quartz default, which still colours the frame and the column and is provisional.

### Primary

- **Marker Red** (`marker-red`): the valve mark, a registered or finished race number, a star on the race map. It marks what the author has committed to or done. `marker-shadow` and `contour-burgundy` are its shading and its outline, and burgundy also outlines the radar's knob and stamps a finished race.

### Secondary

- **Steel Blue** (`steel-blue`): the ground of the link preview cards and the avatar, and the first of the book cover colours.

### Tertiary

- **Cover colours** (`steel-blue`, `cover-forest`, `cover-brick`, `cover-ochre`, `cover-plum`, `cover-sage`, `cover-slate`, `cover-wine`): the eight marker colours a book spine is drawn in when its card names none. Lettering on a spine is `ink` on a light cover and `paper-cream` on a dark one.

### Neutral

- **Paper Cream** (`paper-cream`): every paper object: a bib, a map marker, a radar blip label, the card title. `page-edge` is the cut of a book's pages; `band-paper` and `band-sticker` are the publisher's band and price sticker on a book not yet begun.
- **Ink on Paper** (`ink-on-paper`, `note-on-paper`): text on a cream object, main and secondary. Fixed in both themes, because the paper does not change with the theme.
- **Pencil and paper** are not fixed colours: pencil is the theme's text colour (`inherited-text` / `inherited-text-dark`) and the paper under a pencil drawing is the page ground. A pencil drawing therefore inverts with the theme; a marker or paper object does not.
- **Inherited** (`inherited-*`): the Quartz default greys and slate-blue link colour, light and dark. They colour the frame and the reading column today and are to be replaced; a new module does not treat them as the garden's identity.

### Named Rules

**The Pencil Follows the Theme Rule.** Pencil strokes use the page's text colour and sit on the page's ground. Marker and paper keep their own colours in light and dark.

**The Red Means Done Rule.** Marker red is spent on commitment and completion, plus the mark itself. It is not an accent for links, buttons or headings.

**Known defect.** In the dark theme `inherited-muted-dark` on `inherited-ground-dark` gives 3.1:1; it is used for the small uppercase labels of the note header and for secondary text in lists. Body-size text needs 4.5:1.

## Typography

**Hand:** Caveat (variable, 400–700), served from the site.
**Heading font:** Schibsted Grotesk. **Body font:** Source Sans Pro. **Code:** IBM Plex Mono. All three are the Quartz defaults and provisional.

**Character:** a printed page annotated by its owner. The typeset faces carry reading; Caveat carries what the hand wrote on an object.

### Hierarchy

- **Headline** (article title, 2rem): the note's own title under the header row.
- **Title** (h2 1.4rem, h3 1.12rem, h4 and below 1rem): section headings in the column.
- **Body** (1rem, line-height 1.6rem): running text. The annotation under a title is body italic at 1.1rem.
- **Label** (0.7rem, uppercase, letter-spacing 0.06em): field names in the note header. Secondary text in lists and popovers is 0.85rem.
- **Hand** (Caveat 700): a bib number at 4.2rem, a bib name at 1.6rem, a module's drawn heading at 1.7rem, labels inside drawings at their drawn size.

### Named Rules

**The Written-On Rule.** Caveat appears where something is written on a drawn object or, in the direction above, on the frame. Running text is never set in it.

## Layout

A single reading column. The left sidebar is removed; on a wide screen its empty column keeps the text centred, with the table of contents and the graph in a 320px column on the right. Between 800px and 1200px the page is one column with the right column's content under the text; below 800px the same, with 2rem above the header. The header row holds the logo, and the language switch and theme toggle at its right end. A note marked as a landing page is one column of at most 800px with no sidebars.

A drawing takes the column's width. On a narrow screen it keeps a minimum width of 720px and scrolls sideways inside its own box, because shrunk further its labels cannot be read.

## Elevation & Depth

The page is flat. Shadows exist only under things that float over it for a moment: the language note (`0 4px 16px rgba(0,0,0,0.15)`), a footnote tooltip (`0 6px 24px rgba(0,0,0,0.15)`), and a book pulled out of the case. Depth inside a module is drawn: the bookcase is in parallel projection with the shelf running at 18°, faces are outlined, and shade is pencil hatching at half opacity.

**The Drawn Depth Rule.** A module shows depth by construction and hatching. A box-shadow on a card or a panel is not part of this system.

## Shapes

Typeset controls are small and nearly square: 3px on a tag, 4px on the language option, 6px on a popover, a full pill on a status. Paper objects are cut by hand: a bib's corners are `3px 5px 4px 6px`, it lies rotated by under a degree, alternately left and right, and straightens when pointed at.

Drawn strokes are generated. A line from one point to another drifts off the straight by a set amplitude (0.4 to 0.9 units in the existing drawings) from a seeded random source, so the same drawing comes out the same on every build, and the result is baked into SVG paths. Pencil outlines are 0.8 to 1.6 wide; marker shapes carry a contour 1.6 wide in a darkened tone of their own colour.

## Components

### Note header

Under the title: an italic annotation, then the note's fields as a row of pairs, a small uppercase label over its value, wrapping with a 2.5rem gap. Tags are outlined boxes (1px rule, 3px radius) with no fill.

### Language switch

Two short options at the top right. The current language is filled with the link colour; the other is plain text. A language the note does not exist in is shown at half opacity, and pointing at it opens a popover that says so.

### Popover

Language note and footnote tooltip share one form: page ground, 1px rule, 6px radius, 0.85rem text, a soft shadow, at most 24rem wide.

### Sources and texts list

A plain list under the text with a 1.2rem heading; an entry's secondary part (kind, date) follows in 0.85rem muted text. No drawing.

### Drawing

A hand drawing from the texts repository, inlined as SVG so that its labels are page text and its shapes can be links. A linked shape thickens its stroke to 4 on hover and focus, and its label underlines.

### Post cover

A dated post may carry a cover image. Covers are black and white, with grain. Nothing on the site enforces this yet; it holds by the choice of images.

### Bookcase

The library as one case in pencil with books in marker. Read books stand on the shelves, a shelf run per group. Books not yet begun lie in stacks on nightstands beside the case, still in their paper band; the ones being read lie on top. A book can be pulled out to show its card.

### Radar

A pencil instrument with a round scope, rings from the hub outwards, and a cream knob outlined in burgundy. Blips are numbered in Caveat on cream. The scope is the picture; the list under it is the content and works without a script.

### Bib

A race the author picked, as a paper bib: cream ground, 2px outline, four pin dots in the corners, the distance as a large Caveat number. A planned race has a dashed outline; a registered one turns the number marker red; a finished one gets a burgundy uppercase stamp.

## Do's and Don'ts

### Do:

- **Do** start a new module by naming the object from the study it is, then draw that object.
- **Do** draw structure in pencil (the theme's text colour) and what carries meaning in marker with a darker contour.
- **Do** generate strokes from a seed and bake them into paths, as `bookcase.tsx` and `brand/src/gen_icon.py` do.
- **Do** keep content reachable without the drawing: a list under the radar, the picks under the calendar.
- **Do** give every moving drawn part a `prefers-reduced-motion` override, as the four drawn modules do.

### Don't:

- **Don't** set running text in Caveat.
- **Don't** put a box-shadow on a card or a panel; shadows belong to popovers and to a book pulled from the case.
- **Don't** use marker red as a general accent.
- **Don't** recolour a paper or marker object for the dark theme; only pencil follows the theme.
- **Don't** build on the `inherited-*` colours or the three default fonts as if they were the garden's own; they are due to be replaced.
