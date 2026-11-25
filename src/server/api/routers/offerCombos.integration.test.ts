/**
 * Combo offers through the offers router, against a real Postgres: "any mochi + any sago for
 * $15", authored here and served by the order server. What these pin is the router's half -
 * the slots it stores, the price ceiling it names, and the switch between kinds it refuses -
 * which the schema cannot see.
 *
 * Skips when TEST_DATABASE_URL is unset; see `src/test/db.ts`.
 */
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("~/server/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

import { revalidateTag } from "next/cache";
import type { z } from "zod";

import type { createOfferSchema } from "~/app/components/schemas";
import { APP_OFFER_TAG } from "~/server/appOffer";
import { db } from "~/server/db";
import { adminCaller } from "~/test/caller";
import { describeIfDb, resetDatabase } from "~/test/db";

type OfferInput = z.input<typeof createOfferSchema>;

/** Mochi from $9.50 and Sago from $8.00: a pair of them is $17.50 at the least. */
const seedMenu = async () => {
  const category = (name: string, chineseName: string) =>
    db.category.create({ data: { name, chineseName } });
  const mochi = await category("Mochi Series", "麻糬系列");
  const sago = await category("Sago Series", "西米露系列");
  const dessert = (name: string, priceInCents: number, categoryId: string) =>
    db.dessert.create({
      data: {
        name,
        chineseName: name,
        priceInCents,
        imagePath: `/desserts/${name}.jpg`,
        imagePublicId: `products/${name}`,
        categoryId,
      },
    });
  const taro = await dessert("Taro Mochi Bowl", 1050, mochi.id);
  await dessert("Matcha Mochi Bowl", 950, mochi.id);
  await dessert("Mango Sago", 800, sago.id);
  return { mochi, sago, taro };
};

const comboInput = (overrides: Partial<OfferInput> = {}): OfferInput => ({
  name: "Mochi + Sago",
  image: null,
  isActive: true,
  startsOn: null,
  endsOn: null,
  audience: "EVERYONE",
  dessertId: null,
  categoryId: null,
  itemPriceInCents: null,
  discountAmount: null,
  comboPriceInCents: 1500,
  comboSlots: [],
  limit: 1,
  renewsWeekly: false,
  requirements: [],
  ...overrides,
});

const slotsOf = (offerId: string) =>
  db.offerComboSlot.findMany({
    where: { offerId },
    orderBy: { position: "asc" },
    select: { position: true, dessertId: true, categoryId: true },
  });

describeIfDb("combo offers in the offers router", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.mocked(revalidateTag).mockClear();
  });

  it("stores a combo's price and its parts in order", async () => {
    const { mochi, sago } = await seedMenu();
    const caller = adminCaller();

    const created = await caller.offer.createOffer({
      offer: comboInput({
        comboSlots: [{ categoryId: mochi.id }, { categoryId: sago.id }],
      }),
    });

    const stored = await db.offer.findUniqueOrThrow({
      where: { id: created.id },
      select: { comboPriceInCents: true, dessertId: true, categoryId: true },
    });
    expect(stored).toEqual({ comboPriceInCents: 1500, dessertId: null, categoryId: null });
    expect(await slotsOf(created.id)).toEqual([
      { position: 0, dessertId: null, categoryId: mochi.id },
      { position: 1, dessertId: null, categoryId: sago.id },
    ]);
    // The app-offer pop-up's cache, as any offer write does.
    expect(revalidateTag).toHaveBeenCalledWith(APP_OFFER_TAG);
  });

  it("reads a combo back with its parts named, for the table and the dialog", async () => {
    const { mochi, taro } = await seedMenu();
    const caller = adminCaller();
    await caller.offer.createOffer({
      offer: comboInput({
        comboSlots: [{ dessertId: taro.id }, { categoryId: mochi.id }],
      }),
    });

    const [offer] = await caller.offer.getOffers();

    expect(offer?.comboPriceInCents).toBe(1500);
    expect(
      offer?.comboSlots.map((slot) => ({
        position: slot.position,
        dessert: slot.dessert?.name ?? null,
        category: slot.category?.name ?? null,
      })),
    ).toEqual([
      { position: 0, dessert: "Taro Mochi Bowl", category: null },
      { position: 1, dessert: null, category: "Mochi Series" },
    ]);
  });

  it("refuses a combo priced at or above its cheapest picks, and says what they add up to", async () => {
    const { mochi, sago } = await seedMenu();
    const caller = adminCaller();

    await expect(
      caller.offer.createOffer({
        offer: comboInput({
          comboPriceInCents: 1750,
          comboSlots: [{ categoryId: mochi.id }, { categoryId: sago.id }],
        }),
      }),
    ).rejects.toThrow(
      "Mochi Series from $9.50 + Sago Series from $8.00 = $17.50",
    );
    expect(await db.offer.count()).toBe(0);
  });

  it("replaces a combo's parts on save", async () => {
    const { mochi, sago, taro } = await seedMenu();
    const caller = adminCaller();
    const created = await caller.offer.createOffer({
      offer: comboInput({
        comboSlots: [{ categoryId: mochi.id }, { categoryId: sago.id }],
      }),
    });

    await caller.offer.updateOffer({
      offer: {
        ...comboInput({
          comboPriceInCents: 1600,
          comboSlots: [
            { dessertId: taro.id },
            { categoryId: sago.id },
            { categoryId: sago.id },
          ],
        }),
        id: created.id,
      },
    });

    expect(await slotsOf(created.id)).toEqual([
      { position: 0, dessertId: taro.id, categoryId: null },
      { position: 1, dessertId: null, categoryId: sago.id },
      { position: 2, dessertId: null, categoryId: sago.id },
    ]);
  });

  /**
   * The order server tells a combo from a single offer by its price column, and a cart line
   * from either by its `comboId`. Switching an offer between the two would leave every cart
   * line and order line under it meaning something else.
   */
  it("refuses to turn a combo into a single offer, or one into a combo", async () => {
    const { mochi, sago } = await seedMenu();
    const caller = adminCaller();
    const combo = await caller.offer.createOffer({
      offer: comboInput({
        comboSlots: [{ categoryId: mochi.id }, { categoryId: sago.id }],
      }),
    });
    const single = await caller.offer.createOffer({
      offer: comboInput({
        name: "Half price sago",
        comboPriceInCents: null,
        categoryId: sago.id,
        discountAmount: 50,
      }),
    });

    await expect(
      caller.offer.updateOffer({
        offer: {
          ...comboInput({
            comboPriceInCents: null,
            categoryId: sago.id,
            discountAmount: 50,
          }),
          id: combo.id,
        },
      }),
    ).rejects.toThrow(/combo/i);
    await expect(
      caller.offer.updateOffer({
        offer: {
          ...comboInput({
            comboSlots: [{ categoryId: mochi.id }, { categoryId: sago.id }],
          }),
          id: single.id,
        },
      }),
    ).rejects.toThrow(/combo/i);

    expect(await slotsOf(combo.id)).toHaveLength(2);
    expect(await slotsOf(single.id)).toHaveLength(0);
  });
});
