/**
 * How a script should scroll the page: smoothly, unless the reader has asked their
 * device for reduced motion.
 *
 * globals.css sets `scroll-behavior: auto !important` under that setting, but CSS
 * only decides for a scroll that leaves the choice to it. A call passing
 * `behavior: "smooth"` overrides it, so every smooth scroll asks this instead.
 * Read at the moment of scrolling, so a setting changed mid-visit counts.
 */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}
