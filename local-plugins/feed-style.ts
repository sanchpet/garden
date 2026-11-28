// What a browser shows when someone opens the feed itself: the title, a note on what the
// feed is for, then one line per entry, its title or a note's
// address on the left and its day on the right. Both are XHTML that feed-atom.ts writes into
// the feed; the Atom text is hidden.

export function feedCss(textFaces: string): string {
  return `${textFaces}
@font-face {
  font-family: "Caveat";
  src: url("/static/caveat.woff2") format("woff2");
  font-weight: 400 700;
  font-display: swap;
}
feed {
  --ground: #faf5e9;
  --text: #33302b;
  --heading: #1b1a1c;
  --note: #6b6459;
  --rule: #e3d9c4;
  --link: #1e3959;
  --hover: #8c2f39;
  display: block;
  max-width: 44rem;
  margin: 0 auto;
  padding: 3rem 1.25rem 4rem;
  background: var(--ground);
  color: var(--text);
  font-family: "Literata", Georgia, serif;
  font-size: 1.125rem;
  line-height: 1.65;
}
@media (prefers-color-scheme: dark) {
  feed {
    --ground: #161819;
    --text: #dad3c5;
    --heading: #f5ecdc;
    --note: #a39b8c;
    --rule: #3b3832;
    --link: #9dbadb;
    --hover: #e0b25a;
  }
}
::selection {
  background: #f2b705;
  color: #1b1a1c;
}
/* Only the feed's own parts show: an element a browser extension puts into the document
   (Dark Reader adds a style element) would otherwise be drawn as text. */
feed > :not(title, div.subscribe, entry),
style,
script {
  display: none !important;
}
id,
link,
updated,
published,
category,
author {
  display: none;
}
feed > title {
  display: block;
  margin-bottom: 2rem;
  color: var(--heading);
  font-size: 2.2rem;
  font-weight: 600;
  line-height: 1.2;
}
div.subscribe {
  display: block;
  margin: 0 0 2.25rem;
}
div.subscribe p {
  margin: 0 0 0.6rem;
}
div.subscribe p.label {
  margin: 0 0 0.25rem;
  color: var(--note);
  font-family: "Caveat", cursive;
  font-weight: 700;
  font-size: 1.3rem;
  line-height: 1.2;
}
div.subscribe a {
  color: var(--link);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--link) 45%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.15em;
}
div.subscribe a:hover {
  color: var(--hover);
  text-decoration-color: currentColor;
}
div.subscribe code {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.9em;
  user-select: all;
  -webkit-user-select: all;
  cursor: copy;
}
span.copied {
  margin-left: 0.5rem;
  color: var(--note);
  font-family: "Caveat", cursive;
  font-weight: 700;
  font-size: 1.15rem;
}
div.subscribe div.callout {
  display: block;
  margin: 0.9rem 0;
  padding: 0.6rem 0.9rem 0.05rem;
  border: 1px solid color-mix(in srgb, var(--link) 35%, transparent);
  border-radius: 4px 6px 5px 7px;
  background: color-mix(in srgb, var(--link) 6%, transparent);
}
div.subscribe p.callout-title {
  color: var(--link);
  font-weight: 600;
}
entry > *:not(a) {
  display: none;
}
entry {
  display: block;
  border-top: 1px solid var(--rule);
}
entry:last-of-type {
  border-bottom: 1px solid var(--rule);
}
a.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.55rem 0;
  color: var(--link);
  line-height: 1.4;
  text-decoration: none;
}
a.row span {
  min-width: 0;
  overflow-wrap: anywhere;
}
a.row:hover {
  color: var(--hover);
}
a.row:focus-visible {
  outline: 2px solid var(--link);
  outline-offset: 2px;
}
a.note span {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.95rem;
}
a.row time {
  flex: none;
  color: var(--note);
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (max-width: 480px) {
  a.row {
    flex-direction: column;
    gap: 0.1rem;
  }
}
`
}
