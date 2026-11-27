// What a browser shows when someone opens the feed itself: the entries as a readable column in
// the site's paper or graphite, and a note on what the address is for. CSS styles the Atom
// elements directly; it cannot make links, so the page is a card to read, not to navigate.

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
entry {
  display: block;
  padding: 1.1rem 0;
  border-top: 1px solid var(--rule);
}
entry > title {
  display: block;
  color: var(--heading);
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.35;
}
summary,
content {
  display: -webkit-box;
  margin-top: 0.4rem;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  white-space: pre-line;
}
summary + content {
  display: none;
}
`
}
