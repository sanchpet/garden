import type { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { cursorForms, type Form } from "./cursor-forms"
// @ts-ignore
import script from "./cursor.inline"

// The drawn cursor (DESIGN.md, Cursor): the pointer as the owner's pencil, with brackets,
// a marker and a scope's crosshair where the page asks for them. The drawings are baked here;
// the page script mounts them and moves them.
const forms = cursorForms()

function placed(name: string, form: Form): string {
  const [x, y] = form.hotspot
  return `<span class="dc-form" data-form="${name}" style="transform:translate(${-x}px,${-y}px)">${form.svg}</span>`
}

const LAYER =
  `<div class="dc-pointer">` +
  placed("pencil", forms.pencil) +
  placed("marker", forms.marker) +
  placed("crosshair", forms.crosshair) +
  placed("help", forms.help) +
  placed("dot", forms.dot) +
  `</div>` +
  `<div class="dc-brackets">` +
  forms.corners
    .map((svg, i) => `<span class="dc-corner" data-corner="${i}">${svg}</span>`)
    .join("") +
  `</div>` +
  `<div class="dc-underlines"></div>` +
  `<template class="dc-underline">${forms.underline}</template>`

export const DrawnCursor = (() => {
  const Cursor: QuartzComponent = () => (
    <template id="drawn-cursor" dangerouslySetInnerHTML={{ __html: LAYER }} />
  )
  Cursor.afterDOMLoaded = script
  Cursor.css = `
.drawn-cursor {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
  contain: strict;
}
.drawn-cursor .dc-pointer {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}
.drawn-cursor .dc-form {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  line-height: 0;
  opacity: 0;
}
.drawn-cursor .dc-form > svg {
  overflow: visible;
  transition: transform 0.14s cubic-bezier(0.22, 1, 0.36, 1);
}
.drawn-cursor .dc-form {
  transition: opacity 0.09s ease-out;
}
.drawn-cursor[data-visible="false"] .dc-pointer,
.drawn-cursor[data-visible="false"] .dc-brackets,
.drawn-cursor[data-visible="false"] .dc-underlines {
  visibility: hidden;
}
.drawn-cursor[data-mode="pencil"] .dc-form[data-form="pencil"],
.drawn-cursor[data-mode="underline"] .dc-form[data-form="pencil"],
.drawn-cursor[data-mode="marker"] .dc-form[data-form="marker"],
.drawn-cursor[data-mode="crosshair"] .dc-form[data-form="crosshair"],
.drawn-cursor[data-mode="help"] .dc-form[data-form="help"],
.drawn-cursor[data-mode="bracket"] .dc-form[data-form="dot"] {
  opacity: 1;
}
.drawn-cursor[data-mode="native"] .dc-pointer {
  visibility: hidden;
}
.drawn-cursor[data-pressed="true"] .dc-form > svg {
  transform: scale(0.86);
}
.drawn-cursor .dc-brackets {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  transition: opacity 0.12s ease-out;
}
.drawn-cursor .dc-brackets[data-on="true"] {
  opacity: 1;
}
.drawn-cursor .dc-corner {
  position: absolute;
  line-height: 0;
  color: var(--darkgray);
  transition: translate 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}
.drawn-cursor .dc-corner[data-corner="0"] { top: 0; left: 0; translate: -4px -4px; }
.drawn-cursor .dc-corner[data-corner="1"] { top: 0; right: 0; rotate: 90deg; translate: 4px -4px; }
.drawn-cursor .dc-corner[data-corner="2"] { bottom: 0; right: 0; rotate: 180deg; translate: 4px 4px; }
.drawn-cursor .dc-corner[data-corner="3"] { bottom: 0; left: 0; rotate: 270deg; translate: -4px 4px; }
.drawn-cursor .dc-brackets[data-on="true"] .dc-corner { translate: 0 0; }
.drawn-cursor .dc-underline-line {
  position: absolute;
  top: 0;
  left: 0;
  height: 6px;
  line-height: 0;
}
.drawn-cursor .dc-underline-line > svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
/* Drawn on from the left. A clip, not a dash: the stroke is stretched to the line's width. */
.drawn-cursor .dc-underline-line {
  animation: dc-draw 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes dc-draw {
  from { clip-path: inset(-4px 100% -4px 0); }
  to { clip-path: inset(-4px 0 -4px 0); }
}
html.dc-on:not([data-dc-native]),
html.dc-on:not([data-dc-native]) * {
  cursor: none !important;
}
html.dc-on article a[data-dc-underlined] {
  text-decoration-color: transparent !important;
}
@media (prefers-reduced-motion: reduce) {
  .drawn-cursor .dc-form,
  .drawn-cursor .dc-form > svg,
  .drawn-cursor .dc-brackets,
  .drawn-cursor .dc-corner {
    transition: none;
  }
  .drawn-cursor .dc-underline-line {
    animation: none;
  }
}
`
  return Cursor
}) satisfies QuartzComponentConstructor
