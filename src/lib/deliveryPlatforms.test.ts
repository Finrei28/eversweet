import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DELIVERY_PLATFORMS } from "./deliveryPlatforms";

/**
 * The home page's delivery band links to the shop's own store on each platform. The links were
 * copied from search results, which add tracking tokens and, for DoorDash, `pickup=true`, which
 * opens the store in pickup mode rather than delivery.
 */
describe("DELIVERY_PLATFORMS", () => {
  it("offers Uber Eats, DoorDash and HungryPanda, in that order", () => {
    expect(DELIVERY_PLATFORMS.map((p) => p.name)).toEqual([
      "Uber Eats",
      "DoorDash",
      "HungryPanda",
    ]);
  });

  it("links each to this shop's store on the platform's own site", () => {
    const [uberEats, doorDash, hungryPanda] = DELIVERY_PLATFORMS.map(
      (p) => new URL(p.href),
    );
    expect(uberEats!.hostname).toBe("www.ubereats.com");
    expect(uberEats!.pathname).toBe(
      "/nz/store/eversweet/cdSuxGsZSUSGotTxyjfrvQ",
    );
    expect(doorDash!.hostname).toBe("www.doordash.com");
    expect(doorDash!.pathname).toBe(
      "/store/eversweet-auckland-34536099/71053546/",
    );
    expect(hungryPanda!.hostname).toBe("nzd.hungrypanda.co");
    expect(hungryPanda!.searchParams.get("shopId")).toBe("136820118");
  });

  it("carries no tracking tokens and never opens in pickup mode", () => {
    for (const { href } of DELIVERY_PLATFORMS) {
      const url = new URL(href);
      expect(url.protocol).toBe("https:");
      for (const key of url.searchParams.keys()) {
        expect(key).not.toMatch(
          /^(rwg_token|srsltid|utm_.*|pickup|delivery_method|channel_source|is_gfo|isRedirect)$/,
        );
      }
    }
  });

  it("gives each an icon that is in public/", () => {
    for (const { icon } of DELIVERY_PLATFORMS) {
      expect(icon).toMatch(/^\/[a-z-]+\.png$/);
      expect(existsSync(join(process.cwd(), "public", icon))).toBe(true);
    }
  });
});
