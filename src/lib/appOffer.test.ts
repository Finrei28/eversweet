import { beforeEach, describe, expect, it, vi } from "vitest";

type AppOfferModule = typeof import("./appOffer");

/**
 * Each test gets a fresh module: the session rule keeps a page-load memory at module scope,
 * for a browser that refuses storage, and one test's visit must not leak into the next.
 */
let mod: AppOfferModule;
beforeEach(async () => {
  vi.resetModules();
  mod = await import("./appOffer");
});

/** A Storage that keeps what it is given, like sessionStorage. */
const memoryStorage = (): Pick<Storage, "getItem" | "setItem"> => {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
};

/** A Storage that throws on every call, as Safari's private mode used to. */
const refusingStorage = (): Pick<Storage, "getItem" | "setItem"> => ({
  getItem: () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
  setItem: () => {
    throw new DOMException(
      "The quota has been exceeded.",
      "QuotaExceededError",
    );
  },
});

describe("which pages the app offer may open on", () => {
  it.each(["/", "/menu", "/contact", "/feedback", "/about-us"])(
    "opens on %s",
    (path) => {
      expect(mod.appOfferAllowedOn(path)).toBe(true);
    },
  );

  it.each(["/privacy-policy", "/terms-and-conditions"])(
    "opens on the legal page %s",
    (path) => {
      expect(mod.appOfferAllowedOn(path)).toBe(true);
    },
  );

  // A payment must never be interrupted, and someone deleting their app account is leaving.
  it.each(["/checkout", "/checkout/", "/order", "/order/", "/delete-account"])(
    "never opens on %s",
    (path) => {
      expect(mod.appOfferAllowedOn(path)).toBe(false);
    },
  );

  it("keeps clear of anything under checkout or an order", () => {
    expect(mod.appOfferAllowedOn("/checkout/anything")).toBe(false);
    expect(mod.appOfferAllowedOn("/order/abc")).toBe(false);
  });

  it("does not mistake a page that only starts with the same letters", () => {
    expect(mod.appOfferAllowedOn("/orders-and-more")).toBe(true);
  });

  it("waits while the path is not known yet", () => {
    expect(mod.appOfferAllowedOn(null)).toBe(false);
  });
});

describe("once per browser session", () => {
  it("has not been seen in a new session", () => {
    expect(mod.hasSeenAppOffer(memoryStorage())).toBe(false);
  });

  it("is remembered in the session's storage once shown", () => {
    const storage = memoryStorage();
    mod.rememberAppOfferSeen(storage, "offer-1");

    expect(storage.getItem(mod.APP_OFFER_SEEN_KEY)).toBe("offer-1");
  });

  it("is not shown again in the same session, even after a full page load", async () => {
    const storage = memoryStorage();
    mod.rememberAppOfferSeen(storage, "offer-1");

    // A reload starts every module afresh; the session's storage is what survives it.
    vi.resetModules();
    const reloaded: AppOfferModule = await import("./appOffer");
    expect(reloaded.hasSeenAppOffer(storage)).toBe(true);
  });

  it("shows again in a new session", async () => {
    mod.rememberAppOfferSeen(memoryStorage(), "offer-1");

    vi.resetModules();
    const nextSession: AppOfferModule = await import("./appOffer");
    expect(nextSession.hasSeenAppOffer(memoryStorage())).toBe(false);
  });

  it("works without storage, showing once per page load", () => {
    const storage = refusingStorage();
    expect(mod.hasSeenAppOffer(storage)).toBe(false);

    expect(() => mod.rememberAppOfferSeen(storage, "offer-1")).not.toThrow();
    // Not again on the next page this load reaches, though nothing could be saved.
    expect(mod.hasSeenAppOffer(storage)).toBe(true);
  });

  it("works when the page cannot reach storage at all", () => {
    expect(mod.hasSeenAppOffer(null)).toBe(false);
    mod.rememberAppOfferSeen(null, "offer-1");
    expect(mod.hasSeenAppOffer(null)).toBe(true);
  });

  it("finds no storage rather than throwing when the browser refuses it", () => {
    const blocked = {
      get sessionStorage(): Storage {
        throw new DOMException("Access is denied", "SecurityError");
      },
    };
    expect(mod.sessionStore(blocked)).toBeNull();
    expect(mod.sessionStore(undefined)).toBeNull();
  });
});

describe("waiting for a quiet moment", () => {
  it("opens after three seconds", () => {
    expect(mod.APP_OFFER_DELAY_MS).toBe(3000);
  });

  it("counts the time the page has had nothing else open", () => {
    let quiet = 0;
    for (let i = 0; i < 4; i++) quiet = mod.quietAfterTick(quiet, 500, false);
    expect(quiet).toBe(2000);
  });

  // The cart, the customise sheet or the closure notice: the offer waits until it closes,
  // then the full three seconds, rather than popping up the instant the customer closes it.
  it("starts again from nothing whenever another dialog is open", () => {
    let quiet = mod.quietAfterTick(2500, 500, false);
    expect(quiet).toBe(3000);
    quiet = mod.quietAfterTick(2500, 500, true);
    expect(quiet).toBe(0);
  });

  it("sees another open dialog or sheet on the page", () => {
    const page = (found: string | null) => ({
      querySelector: (selector: string) =>
        found !== null && selector.includes(found) ? {} : null,
    });

    expect(
      mod.anotherDialogOpen(page('[role="dialog"][data-state="open"]')),
    ).toBe(true);
    expect(
      mod.anotherDialogOpen(page('[role="alertdialog"][data-state="open"]')),
    ).toBe(true);
    expect(mod.anotherDialogOpen(page(null))).toBe(false);
  });
});

describe("what the pop-up says", () => {
  // The offer as it stands in production (2026-11-21): new users, one bowl, 50%.
  const sago = {
    discountPercent: 50,
    audience: "NEW_USERS" as const,
    limit: 1,
    renewsWeekly: false,
  };

  it("says the approved English", () => {
    expect(mod.appOfferCopy(sago, "en")).toEqual({
      eyebrow: "App-only offer",
      title: "50% off selected sago bowls",
      terms:
        "New to the app? One bowl at half price on your first order in the Eversweet app.",
      notOnWebsite: "Not available on this website.",
      dismiss: "Not now",
      close: "Close",
    });
  });

  it("says the approved Chinese", () => {
    expect(mod.appOfferCopy(sago, "zh")).toEqual({
      eyebrow: "应用专属优惠",
      title: "指定西米露半价",
      terms: "Eversweet 应用新用户首单，一份半价。",
      notOnWebsite: "本网站不适用此优惠。",
      dismiss: "暂不需要",
      close: "关闭",
    });
  });

  it("never suggests the website applies it", () => {
    for (const language of ["en", "zh"] as const) {
      const copy = mod.appOfferCopy(sago, language);
      expect(copy.notOnWebsite).toMatch(
        /not available on this website|本网站不适用/i,
      );
      expect(copy.terms).toMatch(/Eversweet app|Eversweet 应用/);
    }
  });

  // Read from the live offer, so an edit in /admin/offers cannot leave it promising last
  // month's terms.
  it("follows the offer's percentage", () => {
    const thirty = { ...sago, discountPercent: 30 };
    expect(mod.appOfferCopy(thirty, "en").title).toBe(
      "30% off selected sago bowls",
    );
    expect(mod.appOfferCopy(thirty, "en").terms).toBe(
      "New to the app? One bowl at 30% off on your first order in the Eversweet app.",
    );
    // 30% off is 7折 in Chinese, which counts what is paid rather than what comes off.
    expect(mod.appOfferCopy(thirty, "zh").title).toBe("指定西米露7折");
    expect(mod.appOfferCopy(thirty, "zh").terms).toBe(
      "Eversweet 应用新用户首单，一份7折。",
    );
    expect(mod.appOfferCopy({ ...sago, discountPercent: 15 }, "zh").title).toBe(
      "指定西米露8.5折",
    );
  });

  it("says a bowl that costs nothing is free", () => {
    const free = { ...sago, discountPercent: 100 };
    expect(mod.appOfferCopy(free, "en").terms).toBe(
      "New to the app? One bowl free on your first order in the Eversweet app.",
    );
    expect(mod.appOfferCopy(free, "zh").title).toBe("指定西米露免费");
    expect(mod.appOfferCopy(free, "zh").terms).toBe(
      "Eversweet 应用新用户首单，一份免费。",
    );
  });

  it("follows the offer's limit", () => {
    const three = { ...sago, limit: 3 };
    expect(mod.appOfferCopy(three, "en").terms).toBe(
      "New to the app? Up to 3 bowls at half price on your first order in the Eversweet app.",
    );
    expect(mod.appOfferCopy(three, "zh").terms).toBe(
      "Eversweet 应用新用户首单，最多 3 份半价。",
    );
  });

  it("follows the offer's audience", () => {
    const members = { ...sago, audience: "MEMBERS" as const };
    expect(mod.appOfferCopy(members, "en").terms).toBe(
      "For members: one bowl at half price in the Eversweet app.",
    );
    expect(mod.appOfferCopy(members, "zh").terms).toBe(
      "Eversweet 应用会员专享，一份半价。",
    );

    const everyone = { ...sago, audience: "EVERYONE" as const };
    expect(mod.appOfferCopy(everyone, "en").terms).toBe(
      "One bowl at half price in the Eversweet app.",
    );
    expect(mod.appOfferCopy(everyone, "zh").terms).toBe(
      "在 Eversweet 应用下单，一份半价。",
    );
  });

  it("says a weekly allowance is weekly", () => {
    const weekly = {
      ...sago,
      audience: "MEMBERS" as const,
      renewsWeekly: true,
    };
    expect(mod.appOfferCopy(weekly, "en").terms).toBe(
      "For members: one bowl at half price each week in the Eversweet app.",
    );
    expect(mod.appOfferCopy(weekly, "zh").terms).toBe(
      "Eversweet 应用会员专享，每周一份半价。",
    );
    // A new customer's offer ends with their first order, so a week means nothing to it.
    expect(mod.appOfferCopy({ ...sago, renewsWeekly: true }, "en").terms).toBe(
      "New to the app? One bowl at half price on your first order in the Eversweet app.",
    );
  });
});
