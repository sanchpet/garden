// A click that means "open here": the main button with no modifier. Any other keeps the
// browser's own meaning (new tab, new window, download).
export const opensHere = (
  event: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
