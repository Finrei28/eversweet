import { useEffect, useState, useSyncExternalStore } from "react";

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

/** How long until the next whole minute begins. */
export const msUntilNextMinute = (now: Date): number =>
  60_000 - (now.getTime() % 60_000);

/**
 * The time now, ticking at each whole minute, for what a page says about the time of
 * day: "Open today until 10:00 pm" and the opening hours' "Today". Each section that
 * shows one calls this; a section that only re-rendered for other reasons left "Today"
 * on yesterday's row past midnight.
 *
 * Also re-read when the tab comes back into view, because a browser slows or stops the
 * timers of a tab in the background, and a page left open overnight is exactly that.
 */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, msUntilNextMinute(new Date()));
    };
    timer = setTimeout(tick, msUntilNextMinute(new Date()));

    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return now;
}
