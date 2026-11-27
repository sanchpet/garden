---
name: sanch.pet
description: A workbook on paper, typeset, with the owner's hand in the margins
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
  page-paper: "#FAF5E9"
  paper-rule: "#E3D9C4"
  ink-text: "#33302B"
  graphite: "#161819"
  graphite-rule: "#3B3832"
  chalk-note: "#A39B8C"
  chalk-text: "#DAD3C5"
  link-on-graphite: "#9DBADB"
  hover-on-graphite: "#E0B25A"
  italic-on-paper: "#2F5D50"
  bold-on-paper: "#A4452C"
  italic-on-graphite: "#9CC3B8"
  bold-on-graphite: "#EBA58C"
typography:
  hand:
    fontFamily: "Caveat, cursive"
    fontWeight: 700
  headline:
    fontFamily: "Literata"
    fontSize: "2.2rem"
    fontWeight: 600
  title:
    fontFamily: "Literata"
    fontSize: "1.6rem"
    fontWeight: 600
  body:
    fontFamily: "Literata"
    fontSize: "1.125rem"
    lineHeight: 1.65
  label:
    fontFamily: "Caveat, cursive"
    fontSize: "1.15rem"
    fontWeight: 700
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
    backgroundColor: "{colors.steel-blue}"
    textColor: "{colors.page-paper}"
    rounded: "{rounded.control}"
    padding: "0.1rem 0.45rem"
  popover:
    backgroundColor: "{colors.page-paper}"
    textColor: "{colors.ink-text}"
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

The page is paper in the light theme and graphite in the dark one. The text is set in a book serif. The hand reaches the frame as the owner's marginal notes: pencil rules and underlines in place of straight lines, and the labels of blocks written in handwriting. Headings and running text stay typeset. One thing in the reading column is written by hand: a quotation, which the author uses for his own annotations, is set behind a pencil line in a hand that prints its letters (Neucha), as a note in the margin: an annotation runs to paragraphs, and the cursive of the labels is slow to read at that length. A callout stays typeset.

**Key Characteristics:**

- Text is typeset, objects are drawn. A module is an object from the study before it is a widget.
- Pencil for structure, marker for what carries meaning.
- Handwriting (Caveat) for anything written on a drawn object.
- Flat page. Depth comes from drawn projection, never from shadows on the page.
- The hand is reproducible: strokes are generated from a seed and baked into paths.

## Colors

One palette for the page and for what is drawn on it: paper and ink, steel blue for links, marker colours for meaning.

### Primary

- **Marker Red** (`marker-red`): the valve mark, a registered or finished race number, a star on the race map. It marks what the author has committed to or done. `marker-shadow` and `contour-burgundy` are its shading and its outline, and burgundy also outlines the radar's knob and stamps a finished race.

### Secondary

- **Steel Blue** (`steel-blue`): links on paper, the current language in the switch, the ground of the link preview cards and the avatar, and the first of the book cover colours. On graphite a link is `link-on-graphite`. A link under the pointer turns `cover-wine` on paper and `hover-on-graphite` on graphite.

### Tertiary

- **Cover colours** (`steel-blue`, `cover-forest`, `cover-brick`, `cover-ochre`, `cover-plum`, `cover-sage`, `cover-slate`, `cover-wine`): the eight marker colours a book spine is drawn in when its card names none. Lettering on a spine is `ink` on a light cover and `paper-cream` on a dark one.

### Neutral

- **Paper Cream** (`paper-cream`): every paper object: a bib, a map marker, a radar blip label, the card title. `page-edge` is the cut of a book's pages; `band-paper` and `band-sticker` are the publisher's band and price sticker on a book not yet begun.
- **Ink on Paper** (`ink-on-paper`, `note-on-paper`): text on a cream object, main and secondary. Fixed in both themes, because the paper does not change with the theme.
- **Page** (`page-paper`, `graphite`): the ground, light and dark. The page is a lighter sheet than a paper object, so a bib or a marker still reads as a separate piece of paper on it.
- **Text** (`ink-text` and `ink` on paper, `chalk-text` and `paper-cream` on graphite): running text and headings. Secondary text is `note-on-paper` on paper and `chalk-note` on graphite; both clear 4.5:1 on their ground, because they are read as text.
- **Emphasis** (`italic-on-paper`, `bold-on-paper`, `italic-on-graphite`, `bold-on-graphite`): italic and bold in running text each carry a colour of their own, forest green and brick; inside a link the link colour stays. All four clear 4.5:1 on their ground.
- **Rules** (`paper-rule`, `graphite-rule`): hairlines of typeset controls: a tag, a popover, a table row.
- **Pencil** is not a fixed colour: it is the theme's text colour on the page's ground. A pencil drawing therefore inverts with the theme; a marker or paper object does not.

### Named Rules

**The Pencil Follows the Theme Rule.** Pencil strokes use the page's text colour and sit on the page's ground. Marker and paper keep their own colours in light and dark.

**The Red Means Done Rule.** Marker red is spent on commitment and completion, plus the mark itself. It is not an accent for links, buttons or headings.

**The Highlighter Rule.** Selected text and a marked passage are washed in the price sticker's yellow, as a highlighter would.

## Typography

**Hand:** Caveat (variable, 400–700), served from the site.
**Text and headings:** Literata, a book serif with Cyrillic. **Code:** IBM Plex Mono.

**Character:** a printed page annotated by its owner. Literata carries reading; Caveat carries what the hand wrote, on an object or in the margin.

### Hierarchy

- **Headline** (600, 2.2rem): the note's own title, underlined in pencil.
- **Title** (600; h2 1.6rem, h3 1.3rem, h4 and below 1.125rem): section headings in the column.
- **Body** (400, 1.125rem, line-height 1.65): running text. The annotation under a title is body italic.
- **Label** (Caveat 700, 1.15rem): the names of the note's fields and the days of the stream. The labels of the right column's blocks are Caveat at 1.45rem, the heading of the sources list at 1.7rem.
- **Hand on objects** (Caveat 700): a bib number at 4.2rem, a bib name at 1.6rem, a module's drawn heading at 1.7rem, labels inside drawings at their drawn size.

### Named Rules

**The Written-On Rule.** Caveat appears where something is written on a drawn object and where the owner labelled a block in the margin. Headings of the text and running text are never set in it.

## Layout

A single reading column. The left sidebar is removed; on a wide screen its empty column keeps the text centred, with the table of contents and the graph in a 320px column on the right. Between 800px and 1200px the page is one column with the right column's content under the text; below 800px the same, with 2rem above the header. The header row holds the logo, and the language switch and theme toggle at its right end. A note marked as a landing page is one column of at most 800px with no sidebars.

The fonts are set by the fonts plugin in `quartz.config.yaml`, not by the theme block. The garden's own CSS is emitted inside a cascade layer while the core's base rules are not, so an override of a base rule carries the important flag.

A drawing takes the column's width. On a narrow screen it keeps a minimum width of 720px and scrolls sideways inside its own box, because shrunk further its labels cannot be read.

## Elevation & Depth

The page is flat. Shadows exist only under things that float over it for a moment: the language note (`0 4px 16px rgba(0,0,0,0.15)`), a footnote tooltip (`0 6px 24px rgba(0,0,0,0.15)`), and a book pulled out of the case. Depth inside a module is drawn: the bookcase is in parallel projection with the shelf running at 18°, faces are outlined, and shade is pencil hatching at half opacity.

**The Drawn Depth Rule.** A module shows depth by construction and hatching. A box-shadow on a card or a panel is not part of this system.

## Shapes

Typeset controls are small and nearly square: 3px on a tag, 4px on the language option, 6px on a popover, a full pill on a status. Paper objects are cut by hand: a bib's corners are `3px 5px 4px 6px`, it lies rotated by under a degree, alternately left and right, and straightens when pointed at.

Straight lines of the frame are pencil strokes: the rule between sections, the underline of a note's title, the line down the margin of a quotation. Each is one baked stroke used as a mask over the text colour.

Drawn strokes are generated. A line from one point to another drifts off the straight by a set amplitude (0.4 to 0.9 units in the existing drawings) from a seeded random source, so the same drawing comes out the same on every build, and the result is baked into SVG paths. Pencil outlines are 0.8 to 1.6 wide; marker shapes carry a contour 1.6 wide in a darkened tone of their own colour.

## Components

### Note header

Under the title: an italic annotation, then the note's fields as a row of pairs, a handwritten label over its value, wrapping with a 2.5rem gap. Tags are outlined boxes (1px rule, 3px radius) with no fill.

### Language switch

Two short options at the top right. The current language is filled with the link colour; the other is plain text. A language the note does not exist in is shown at half opacity, and pointing at it opens a popover that says so.

### Link

A link in the text is underlined in pen: a 1px underline at 45% of the link colour, full colour under the pointer. No wash behind it.

A footnote mark is the one exception: a superscript number at 600 on a chip of the link colour at 24%, no underline, filled with the link colour under the pointer. A bare digit underlined like a link is lost in running text.

### Cursor

With a mouse the pointer is the owner's pencil (`cursor.tsx`), drawn from a seed like every stroke and following the theme. Over a link in the text the pencil stays and pens a full-colour line under the link in place of the 45% underline. A control outside the text (a button, the language switch, a list row) is framed by four pencil corners, the pencil shrinking to its point and leaning a little towards the block. A drawn object that is a link (a book, a radar blip, a bib, a shape in a drawing) takes a marker: cream barrel, steel-blue nib. A footnote mark gets a handwritten question mark beside the point; the radar's scope a crosshair. Where text is read, selected or typed (the article's running text, the title, the annotation, a field) the system I-beam comes back, since the text is typeset.

The drawing replaces the system cursor only after the first mouse move with the layer already mounted, so a failed script leaves the system cursor. It is off for touch and pen, under `prefers-reduced-data` and `forced-colors`, and when the reader picks "system cursor" under the page; `prefers-reduced-motion` switches forms without the cross-fade and the underline without drawing on.

### View count

Under a post or an evergreen text, below the closing rule: the number of readers in muted 0.8rem text, "128 просмотров" / "128 views". It appears only once the number arrives and is above zero; a blocked or failed request leaves no gap.

### Popover

Language note and footnote tooltip share one form: page ground, 1px rule, 6px radius, 0.85rem text, a soft shadow, at most 24rem wide.

### Sources and texts list

A plain list under the text with a 1.2rem heading; an entry's secondary part (kind, date) follows in 0.85rem muted text. No drawing.

### Stream

A dated list of what happened in the garden, and the same list narrowed to one kind of page (the posts page). Years are labelled by hand, each label followed by a pencil rule. A row is a day written by hand in the margin column (4.6rem), then what happened in 0.85rem muted text, then the page's name as a link; a day is written once for the rows that share it. A text's name is set at 600, a catalogue card's at 400, and cards entered on one day share one row. A note has no name: its day is its link and its text stands in the row at body size. A finished book and a race that was run carry the marker's tick, the only red in the list. Below 560px the day stands above its row. The header's handwritten word leads here from every page.

### Drawing

A hand drawing from the texts repository, inlined as SVG so that its labels are page text and its shapes can be links. A linked shape thickens its stroke to 4 on hover and focus, and its label underlines.

A sketch drawn by hand on a tablet (`.garden-sketch`) comes in the same way, with no paper card of its own: it sits on the page's ground at the size it was drawn, so the handwriting matches the text. Its black pen is pencil and follows the theme; any other pen is a marker from the palette (orange is `cover-ochre`) and keeps its colour.

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
- **Do** leave the system I-beam wherever text is read, selected or typed; the drawn cursor belongs to the frame and the drawings.

### Don't:

- **Don't** set running text in Caveat.
- **Don't** put a box-shadow on a card or a panel; shadows belong to popovers and to a book pulled from the case.
- **Don't** use marker red as a general accent.
- **Don't** recolour a paper or marker object for the dark theme; only pencil follows the theme.
- **Don't** draw a straight rule in the frame where a pencil stroke belongs, or set a block's label in the text face.
