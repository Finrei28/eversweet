/**
 * The rules of the pop-up that sends website visitors to the customer app for its sago
 * offer: which pages it may open on, once per browser session, a quiet moment first, and
 * what it says. The pop-up itself is `~/app/components/appOfferPopup`; the offer is read on
 * the server by `~/server/appOffer`.
 *
 * The offer is the app's alone. Nothing on this website prices against an `Offer` - carts
 * here are priced with `Promo` (`src/server/pricing.ts`) - so every word below says it is an
 * app offer and none suggests the website will apply it.
 */

export type AppOfferAudience = "EVERYONE" | "MEMBERS" | "NEW_USERS";

/** What the browser is told about the offer: enough to word it and picture it. */
export type AppOffer = {
  id: string;
  /** Whole percent off, from `Offer.discountAmount`. */
  discountPercent: number;
  audience: AppOfferAudience;
  /** How many discounted bowls a customer may have (`Offer.limit`). */
  limit: number;
  /** `limit` is an allowance per week rather than per run. */
  renewsWeekly: boolean;
  imageUrl: string | null;
};

/**
 * Pages the pop-up never opens on, nor anything under them. A payment must never be
 * interrupted, nor the order it ends on; and someone on Delete account is leaving the app.
 */
const KEPT_CLEAR = ["/checkout", "/order", "/delete-account"];

/** Every customer page but the ones kept clear. Null is a path not known yet. */
export const appOfferAllowedOn = (pathname: string | null): boolean =>
  pathname !== null &&
  !KEPT_CLEAR.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );

/** The session storage key the pop-up leaves once shown, holding the offer's id. */
export const APP_OFFER_SEEN_KEY = "appOfferSeen";

/**
 * Shown on this page load, for a browser that refuses storage: such a visitor still sees
 * it once per full page load, rather than on every page a navigation reaches.
 */
let seenThisLoad = false;

/**
 * The browser's session storage, or null where it is refused. Reading `sessionStorage` at
 * all can throw (a SecurityError, with site data blocked), as can every call on it.
 */
export const sessionStore = (
  scope: { readonly sessionStorage: Storage } | undefined,
): Storage | null => {
  try {
    return scope?.sessionStorage ?? null;
  } catch {
    return null;
  }
};

/** Whether the pop-up has been shown in this browser session already. */
export const hasSeenAppOffer = (
  storage: Pick<Storage, "getItem"> | null,
): boolean => {
  if (seenThisLoad) return true;
  try {
    return storage?.getItem(APP_OFFER_SEEN_KEY) != null;
  } catch {
    return false;
  }
};

/**
 * Remembered for the rest of the session the moment it opens, so a reload while it is up
 * does not bring it back. A new session (the tab or browser closed and the site reopened)
 * shows it once more.
 */
export const rememberAppOfferSeen = (
  storage: Pick<Storage, "setItem"> | null,
  offerId: string,
): void => {
  seenThisLoad = true;
  try {
    storage?.setItem(APP_OFFER_SEEN_KEY, offerId);
  } catch {
    // Remembered for this page load only, above.
  }
};

/** How long the page must have had nothing else open before the pop-up opens. */
export const APP_OFFER_DELAY_MS = 3000;

/** How often the page is looked at while waiting. */
export const APP_OFFER_TICK_MS = 250;

/**
 * The quiet time after one more tick. Another dialog open - the cart, the customise sheet,
 * the closure notice, the phone's menu - starts it again from nothing, so the offer opens
 * the full delay after that closes rather than the instant the customer closes it.
 */
export const quietAfterTick = (
  quietMs: number,
  tickMs: number,
  blocked: boolean,
): number => (blocked ? 0 : quietMs + tickMs);

/**
 * Radix marks every open dialog and sheet this way, the site's own and any other; the
 * pop-up waits on all of them.
 */
const OPEN_DIALOG =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

export const anotherDialogOpen = (root: {
  querySelector: (selector: string) => unknown;
}): boolean => root.querySelector(OPEN_DIALOG) != null;

export type AppOfferCopy = {
  eyebrow: string;
  title: string;
  terms: string;
  notOnWebsite: string;
  dismiss: string;
  close: string;
};

/**
 * The pop-up's words, from the live offer, so an edit in /admin/offers cannot leave it
 * promising last month's terms. The production offer (new users, one bowl, 50%) reads as
 * the owner approved on 2026-11-21:
 *
 *   App-only offer / 50% off selected sago bowls / New to the app? One bowl at half price
 *   on your first order in the Eversweet app. / Not available on this website.
 *
 * The bowls it covers are "selected" and not named; the app lists them.
 *
 * In Chinese a discount counts what is paid: 30% off is 7折, 50% off is 半价.
 */
export const appOfferCopy = (
  offer: Pick<
    AppOffer,
    "discountPercent" | "audience" | "limit" | "renewsWeekly"
  >,
  language: "en" | "zh",
): AppOfferCopy => {
  const { discountPercent: percent, audience, limit } = offer;
  // A new customer's offer ends with their first order, so it has no weeks.
  const weekly = offer.renewsWeekly && audience !== "NEW_USERS";

  if (language === "en") {
    const bowls = limit === 1 ? "one bowl" : `up to ${limit} bowls`;
    const deal =
      percent === 100
        ? "free"
        : `at ${percent === 50 ? "half price" : `${percent}% off`}`;
    const each = weekly ? " each week" : "";
    const sentence = (text: string) =>
      text.charAt(0).toUpperCase() + text.slice(1);
    return {
      eyebrow: "App-only offer",
      title: `${percent}% off selected sago bowls`,
      terms:
        audience === "NEW_USERS"
          ? `New to the app? ${sentence(bowls)} ${deal} on your first order in the Eversweet app.`
          : audience === "MEMBERS"
            ? `For members: ${bowls} ${deal}${each} in the Eversweet app.`
            : `${sentence(bowls)} ${deal}${each} in the Eversweet app.`,
      notOnWebsite: "Not available on this website.",
      dismiss: "Not now",
      close: "Close",
    };
  }

  const deal =
    percent === 50
      ? "半价"
      : percent === 100
        ? "免费"
        : `${(100 - percent) / 10}折`;
  const bowls = limit === 1 ? "一份" : `最多 ${limit} 份`;
  const each = weekly ? "每周" : "";
  return {
    eyebrow: "应用专属优惠",
    title: `指定西米露${deal}`,
    terms:
      audience === "NEW_USERS"
        ? `Eversweet 应用新用户首单，${bowls}${deal}。`
        : audience === "MEMBERS"
          ? `Eversweet 应用会员专享，${each}${bowls}${deal}。`
          : `在 Eversweet 应用下单，${each}${bowls}${deal}。`,
    notOnWebsite: "本网站不适用此优惠。",
    dismiss: "暂不需要",
    close: "关闭",
  };
};
