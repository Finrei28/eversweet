import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("~/server/db", () => ({ db: { offer: { findMany } } }));

import { type AppOfferCandidate, getAppOffer, pickAppOffer } from "./appOffer";

const NOW = new Date("2026-11-21T03:00:00.000Z");

const bowl = (name: string, fields: Record<string, unknown> = {}) => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  name,
  imagePath: `https://res.cloudinary.com/dlqjgl6ju/image/upload/${name.replace(/\W+/g, "")}.jpg`,
  isAvailableForPurchase: true,
  ...fields,
});

const SAGO_BOWLS = [
  bowl("Coconut Milk Sago"),
  bowl("Durian Sago with Milk Pudding"),
  bowl("Mango Pomelo Sago"),
  bowl("Red Bean Sago"),
];

/**
 * The offer as production holds it (2026-11-21): 50% off the Sago Series for new users,
 * one bowl, leaving out the Durian Sago, no end date. Dates as strings, as they come out
 * of the Next data cache.
 */
const candidate = (
  fields: Partial<AppOfferCandidate> = {},
): AppOfferCandidate => ({
  id: "sago-offer",
  image: null,
  isActive: true,
  startsAt: null,
  endsAt: null,
  archivedAt: null,
  audience: "NEW_USERS",
  itemPriceInCents: null,
  discountAmount: 50,
  limit: 1,
  renewsWeekly: false,
  excludedDessertIds: ["durian-sago-with-milk-pudding"],
  requirementCount: 0,
  category: { name: "Sago Series", desserts: SAGO_BOWLS },
  ...fields,
});

describe("the offer the pop-up advertises", () => {
  it("is the running sago offer, as the app will price it", () => {
    expect(pickAppOffer([candidate()], NOW)).toEqual({
      id: "sago-offer",
      discountPercent: 50,
      audience: "NEW_USERS",
      limit: 1,
      renewsWeekly: false,
      endsAt: null,
      imageUrl: SAGO_BOWLS[2]!.imagePath,
    });
  });

  // The browser holds the offer while it waits for a quiet moment, which can be hours in a
  // tab left open; it needs the end to refuse to open, or to close, once that has passed.
  it("tells the browser when the offer ends", () => {
    expect(
      pickAppOffer([candidate({ endsAt: "2026-11-30T10:59:59.999Z" })], NOW)
        ?.endsAt,
    ).toBe("2026-11-30T10:59:59.999Z");
  });

  it("is nothing when there is no offer", () => {
    expect(pickAppOffer([], NOW)).toBeNull();
  });

  // The whole point of reading the row: an ended or switched-off deal is never advertised.
  it("is nothing once the offer is paused", () => {
    expect(pickAppOffer([candidate({ isActive: false })], NOW)).toBeNull();
  });

  it("is nothing once the offer is archived", () => {
    expect(
      pickAppOffer(
        [candidate({ archivedAt: "2026-11-20T00:00:00.000Z" })],
        NOW,
      ),
    ).toBeNull();
  });

  it("is nothing before the offer starts", () => {
    expect(
      pickAppOffer([candidate({ startsAt: "2026-11-21T03:00:00.001Z" })], NOW),
    ).toBeNull();
    expect(
      pickAppOffer([candidate({ startsAt: "2026-11-21T03:00:00.000Z" })], NOW),
    ).not.toBeNull();
  });

  it("is nothing after the offer's last day, and still something during it", () => {
    expect(
      pickAppOffer([candidate({ endsAt: "2026-11-21T02:59:59.999Z" })], NOW),
    ).toBeNull();
    // Inclusive, like both apps: live at the instant it ends.
    expect(
      pickAppOffer([candidate({ endsAt: "2026-11-21T03:00:00.000Z" })], NOW),
    ).not.toBeNull();
  });

  it("is only ever a sago offer", () => {
    expect(
      pickAppOffer(
        [
          candidate({
            category: { name: "Drink Series", desserts: SAGO_BOWLS },
          }),
        ],
        NOW,
      ),
    ).toBeNull();
    expect(pickAppOffer([candidate({ category: null })], NOW)).toBeNull();
    expect(
      pickAppOffer(
        [candidate({ category: { name: "sago", desserts: SAGO_BOWLS } })],
        NOW,
      ),
    ).not.toBeNull();
  });

  // The words are "X% off": a fixed price or a buy-four-get-one would need others.
  it("is only an offer of a percentage off", () => {
    expect(
      pickAppOffer(
        [candidate({ discountAmount: null, itemPriceInCents: 500 })],
        NOW,
      ),
    ).toBeNull();
  });

  it("is never an offer with requirements to unlock it", () => {
    expect(pickAppOffer([candidate({ requirementCount: 1 })], NOW)).toBeNull();
  });

  it("is nothing when every bowl it covers is left out or off the menu", () => {
    expect(
      pickAppOffer(
        [candidate({ excludedDessertIds: SAGO_BOWLS.map((b) => b.id) })],
        NOW,
      ),
    ).toBeNull();
    expect(
      pickAppOffer(
        [
          candidate({
            excludedDessertIds: [],
            category: {
              name: "Sago Series",
              desserts: SAGO_BOWLS.map((b) => ({
                ...b,
                isAvailableForPurchase: false,
              })),
            },
          }),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it("takes the biggest discount when more than one is running", () => {
    const picked = pickAppOffer(
      [
        candidate({ id: "thirty", discountAmount: 30 }),
        candidate({ id: "fifty", discountAmount: 50 }),
        candidate({ id: "ended", discountAmount: 70, isActive: false }),
      ],
      NOW,
    );
    expect(picked?.id).toBe("fifty");
  });

  describe("its picture", () => {
    it("is the offer's own image when /admin/offers has one", () => {
      const image =
        "https://res.cloudinary.com/dlqjgl6ju/image/upload/products/offer.jpg";
      expect(pickAppOffer([candidate({ image })], NOW)?.imageUrl).toBe(image);
    });

    it("is otherwise the Mango Pomelo Sago", () => {
      expect(pickAppOffer([candidate()], NOW)?.imageUrl).toBe(
        SAGO_BOWLS[2]!.imagePath,
      );
    });

    it("is never a bowl the offer leaves out", () => {
      const picked = pickAppOffer(
        [
          candidate({
            excludedDessertIds: [
              "mango-pomelo-sago",
              "durian-sago-with-milk-pudding",
            ],
          }),
        ],
        NOW,
      );
      expect(picked?.imageUrl).toBe(SAGO_BOWLS[0]!.imagePath);
    });

    it("is never a bowl off the menu", () => {
      const desserts = SAGO_BOWLS.map((b) =>
        b.name === "Mango Pomelo Sago" || b.name === "Coconut Milk Sago"
          ? { ...b, isAvailableForPurchase: false }
          : b,
      );
      const picked = pickAppOffer(
        [candidate({ category: { name: "Sago Series", desserts } })],
        NOW,
      );
      expect(picked?.imageUrl).toBe(SAGO_BOWLS[3]!.imagePath);
    });
  });
});

describe("getAppOffer", () => {
  const row = (fields: Record<string, unknown> = {}) => ({
    id: "sago-offer",
    image: null,
    isActive: true,
    startsAt: null as Date | null,
    endsAt: null as Date | null,
    archivedAt: null as Date | null,
    audience: "NEW_USERS",
    itemPriceInCents: null,
    discountAmount: 50,
    limit: 1,
    renewsWeekly: false,
    excludedDessertIds: ["durian-sago-with-milk-pudding"],
    _count: { requirements: 0 },
    category: { name: "Sago Series", desserts: SAGO_BOWLS },
    ...fields,
  });

  beforeEach(() => {
    findMany.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("reads the live offer", async () => {
    findMany.mockResolvedValue([row()]);

    await expect(getAppOffer(NOW)).resolves.toMatchObject({
      id: "sago-offer",
      discountPercent: 50,
    });
  });

  // The dates leave the data cache as strings; an end date must still end the offer.
  it("ends the offer on its end date, through the cache", async () => {
    findMany.mockResolvedValue([
      row({ endsAt: new Date("2026-11-20T10:59:59.999Z") }),
    ]);

    await expect(getAppOffer(NOW)).resolves.toBeNull();
  });

  it("decides against the time of the request, not of the cached read", async () => {
    findMany.mockResolvedValue([
      row({ endsAt: new Date("2026-11-21T10:59:59.999Z") }),
    ]);

    await expect(getAppOffer(NOW)).resolves.not.toBeNull();
    await expect(
      getAppOffer(new Date("2026-11-21T11:00:00.000Z")),
    ).resolves.toBeNull();
  });

  // This is the website's first read of Offer: name every column, so a column the order
  // server's schema adds later cannot break the read here.
  it("names the columns it reads", async () => {
    findMany.mockResolvedValue([]);
    await getAppOffer(NOW);

    const query = findMany.mock.calls[0]![0] as Record<string, unknown>;
    expect(query.select).toBeDefined();
    expect(query).not.toHaveProperty("include");
  });

  it("shows nothing when the read fails", async () => {
    findMany.mockRejectedValue(new Error("connection refused"));

    await expect(getAppOffer(NOW)).resolves.toBeNull();
  });
});
