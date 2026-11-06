/**
 * Scrolls the app starts itself (auto-advance to the next exercise, jumping
 * to a just-added card or set) animate past other cards on the way. The
 * workout's scroll-spy must not treat those in-between frames as the user
 * choosing a card — it skips updates until this window has passed.
 */
let quietUntil = 0;

export function scrollIntoViewQuietly(el: Element, block: ScrollLogicalPosition) {
  quietUntil = Date.now() + 900;
  el.scrollIntoView({ behavior: "smooth", block });
}

export function isProgrammaticScroll() {
  return Date.now() < quietUntil;
}
