import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { privacyPolicy, termAndConditions } from "~/lib/legalDocuments";
import { APP_STORE_URL, GOOGLE_PLAY_URL, storeBadges } from "./appStores";

describe("store links", () => {
  /** The ids of the live listings: App Store Connect's app id and the Android package. */
  it("point at the Eversweet listings", () => {
    expect(new URL(APP_STORE_URL).hostname).toBe("apps.apple.com");
    expect(APP_STORE_URL).toMatch(/\/id6747155337$/);
    const play = new URL(GOOGLE_PLAY_URL);
    expect(play.hostname).toBe("play.google.com");
    expect(play.searchParams.get("id")).toBe("nz.co.eversweet");
  });
});

describe("storeBadges", () => {
  /** Apple's guidelines: with other stores' badges in the layout, the App Store's goes first. */
  it("puts the App Store first, in both languages", () => {
    expect(storeBadges("en").map((badge) => badge.href)).toEqual([
      APP_STORE_URL,
      GOOGLE_PLAY_URL,
    ]);
    expect(storeBadges("zh").map((badge) => badge.href)).toEqual([
      APP_STORE_URL,
      GOOGLE_PLAY_URL,
    ]);
  });

  /** Both stores ask for the localized badge when the page is in another language. */
  it("shows the Chinese badges on the Chinese site", () => {
    const en = storeBadges("en").map((badge) => badge.src);
    const zh = storeBadges("zh").map((badge) => badge.src);

    expect(zh).not.toEqual(en);
    for (const src of [...en, ...zh]) {
      expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
    }
  });

  /**
   * The pixel sizes are what the page reserves before the image arrives, so a wrong ratio
   * squashes the artwork, which neither store allows.
   */
  it("gives each badge the shape of its artwork", () => {
    const ratios = Object.fromEntries(
      [...storeBadges("en"), ...storeBadges("zh")].map((badge) => [
        badge.src,
        badge.width / badge.height,
      ]),
    );

    expect(ratios["/badges/app-store-en.svg"]).toBeCloseTo(119.66407 / 40, 3);
    expect(ratios["/badges/app-store-zh.svg"]).toBeCloseTo(108.85157 / 40, 3);
    expect(ratios["/badges/google-play-en.png"]).toBeCloseTo(564 / 168, 3);
    expect(ratios["/badges/google-play-zh.png"]).toBeCloseTo(646 / 192, 3);
  });
});

/**
 * The home page's app band and the order confirmation tell website customers what only the
 * app has. Those claims have to stay true, and the legal documents are where this repo
 * records which features are app-only. If one of these fails, a feature has changed sides:
 * update `_homeComponents/get-the-app.tsx` and `order/_components/earnInTheApp.tsx` along
 * with the documents.
 */
describe("what the website says only the app has", () => {
  const section = (
    doc: typeof termAndConditions,
    heading: string,
  ): (typeof doc.sections)[number] => {
    const found = doc.sections.find((s) => s.heading === heading);
    if (!found) throw new Error(`${doc.title} has no section "${heading}"`);
    return found;
  };

  it.each([
    [termAndConditions, "12. Sweet Points"],
    [termAndConditions, "13. The monthly leaderboard and prizes"],
    [termAndConditions, "14. Membership"],
    [privacyPolicy, "9. Notifications"],
  ])("%s: %s is app-only", (doc, heading) => {
    expect(section(doc, heading).appliesTo).toEqual(["app"]);
  });

  it("says the website has no order history, points, membership or offers", () => {
    const web = section(termAndConditions, "5. Ordering without an account");

    expect(web.appliesTo).toEqual(["web"]);
    expect(web.content).toContain("cannot show you your past orders");
    expect(web.content).toContain(
      "Sweet Points, membership and offers are not available there",
    );
  });

  it("says website orders earn no Sweet Points", () => {
    expect(section(termAndConditions, "12. Sweet Points").list).toContain(
      "Orders placed on the website do not earn Sweet Points. Points are an app feature, and the website has no accounts to hold them.",
    );
  });
});
