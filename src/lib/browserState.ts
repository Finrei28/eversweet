import { useSyncExternalStore } from "react";

const noSubscription = () => () => undefined;

/**
 * False on the server and while the page hydrates, true afterwards.
 *
 * The cart is read from localStorage in its provider's first client render, so
 * anything drawn from it (a count, the cart bar) differs from the server's empty
 * cart. Rendering it only once hydrated keeps the first client render equal to
 * the server's and spares React a mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/** Whether the viewport is at least `px` wide; false on the server. */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `md`, where the customer header and the cart become desktop's. */
export const DESKTOP_MIN_WIDTH = 768;
