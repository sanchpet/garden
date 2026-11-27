// What a browser shows when someone opens the feed itself: a note on what the address is for,
// then one line per entry, its title or a note's address on the left and its day on the right.
// The lines are the XHTML rows feed-atom.ts writes into each entry; the Atom text is hidden.

const NOTE = {
  ru: "Это лента для RSS-читалки. Скопируйте адрес страницы в читалку, чтобы подписаться.",
  en: "This is a feed for an RSS reader. Copy the page's address into your reader to subscribe.",
}

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
feed::before {
  display: block;
  margin-bottom: 1.5rem;
  color: var(--note);
  font-family: "Caveat", cursive;
  font-weight: 700;
  font-size: 1.45rem;
  line-height: 1.3;
}
feed:lang(ru)::before {
  content: "${NOTE.ru}";
}
feed:lang(en)::before {
  content: "${NOTE.en}";
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
