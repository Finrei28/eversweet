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

/** The menu, plus a second sago: Lychee at $9.00 beside the $8.00 Mango. */
const seedTwoSagos = async () => {
  const menu = await seedMenu();
  const lychee = await db.dessert.create({
    data: {
      name: "Lychee Sago",
      chineseName: "Lychee Sago",
      priceInCents: 900,
      imagePath: "/desserts/lychee-sago.jpg",
      imagePublicId: "products/lychee-sago",
      categoryId: menu.sago.id,
    },
  });
  const mango = await db.dessert.findFirstOrThrow({ where: { name: "Mango Sago" } });
  return { ...menu, lychee, mango };
};

const exclusionsOf = async (offerId: string) =>
  (
    await db.offerComboSlot.findMany({
      where: { offerId },
      orderBy: { position: "asc" },
      select: { excludedDessertIds: true },
    })
  ).map((slot) => slot.excludedDessertIds);

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

  // "Any sago but the mango": a category part leaves desserts out, as a category offer does.
  it("stores what a category part leaves out, and nothing on a dessert part", async () => {
    const { sago, taro, mango } = await seedTwoSagos();

    const created = await adminCaller().offer.createOffer({
      offer: comboInput({
        comboSlots: [
          { dessertId: taro.id, excludedDessertIds: [taro.id] },
          { categoryId: sago.id, excludedDessertIds: [mango.id, mango.id] },
        ],
      }),
    });

    expect(await exclusionsOf(created.id)).toEqual([[], [mango.id]]);
    const [offer] = await adminCaller().offer.getOffers();
    expect(offer?.comboSlots.map((slot) => slot.excludedDessertIds)).toEqual([
      [],
      [mango.id],
    ]);
  });

  it("takes the price limit from what a part does not leave out", async () => {
    const { mochi, sago, mango } = await seedTwoSagos();
    const caller = adminCaller();
    const slots = [
      { categoryId: mochi.id },
      { categoryId: sago.id, excludedDessertIds: [mango.id] },
    ];

    // Mochi from $9.50 + Sago, less the $8.00 mango, from $9.00 = $18.50.
    await expect(
      caller.offer.createOffer({
        offer: comboInput({ comboPriceInCents: 1850, comboSlots: slots }),
      }),
    ).rejects.toThrow("Mochi Series from $9.50 + Sago Series from $9.00 = $18.50");

    const created = await caller.offer.createOffer({
      offer: comboInput({ comboPriceInCents: 1800, comboSlots: slots }),
    });
    expect(await exclusionsOf(created.id)).toEqual([[], [mango.id]]);
  });

  it.each([
    ["a dessert outside its category", "outside"],
    ["every dessert in its category", "everything"],
  ])("refuses a part that leaves out %s", async (_, shape) => {
    const { mochi, sago, taro, mango, lychee } = await seedTwoSagos();

    await expect(
      adminCaller().offer.createOffer({
        offer: comboInput({
          comboSlots: [
            { categoryId: mochi.id },
            {
              categoryId: sago.id,
              excludedDessertIds:
                shape === "outside" ? [taro.id] : [mango.id, lychee.id],
            },
          ],
        }),
      }),
    ).rejects.toThrow(shape === "outside" ? /not in its category/ : /every dessert/);
    expect(await db.offer.count()).toBe(0);
  });

  // A dialog opened before parts could leave desserts out sends them without the list. Its
  // save keeps what is stored, as an offer's own exclusions are kept; an empty list clears.
  it("keeps a part's exclusions when a save sends none for it", async () => {
    const { mochi, sago, mango } = await seedTwoSagos();
    const caller = adminCaller();
    const created = await caller.offer.createOffer({
      offer: comboInput({
        comboSlots: [
          { categoryId: mochi.id },
          { categoryId: sago.id, excludedDessertIds: [mango.id] },
        ],
      }),
    });
    const save = (comboSlots: OfferInput["comboSlots"]) =>
      caller.offer.updateOffer({
        offer: { ...comboInput({ comboPriceInCents: 1600, comboSlots }), id: created.id },
      });

    await save([{ categoryId: mochi.id }, { categoryId: sago.id }]);
    expect(await exclusionsOf(created.id)).toEqual([[], [mango.id]]);

    await save([{ categoryId: mochi.id }, { categoryId: sago.id, excludedDessertIds: [] }]);
    expect(await exclusionsOf(created.id)).toEqual([[], []]);
  });

  /**
   * Two admins saving one combo. Each save deletes the parts and writes them again; at READ
   * COMMITTED the second save's delete waited on the first's, found the old rows gone once it
   * committed, could not see the new ones, and so its insert hit the (offer, position) unique
   * key and answered a 500.
   *
   * Deterministic rather than two saves fired together, which rarely interleave on a local
   * database, as the announcements suite does it: another admin's save is held open - the offer
   * row written and its parts replaced, not committed - while this save runs. Taking turns, it
   * waits, then replaces the other admin's parts with its own.
   */
  it("makes a save wait for one in progress on the same combo, then saves", async () => {
    const { mochi, sago, taro } = await seedMenu();
    const caller = adminCaller();
    const created = await caller.offer.createOffer({
      offer: comboInput({
        comboSlots: [{ categoryId: mochi.id }, { categoryId: sago.id }],
      }),
    });

    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let written!: () => void;
    const partsWritten = new Promise<void>((resolve) => (written = resolve));

    const otherAdmin = db.$transaction(
      async (tx) => {
        // What a save writes, in the order it writes it: the offer row, then the parts.
        await tx.offer.update({ where: { id: created.id }, data: { name: "Elsewhere" } });
        await tx.offerComboSlot.deleteMany({ where: { offerId: created.id } });
        await tx.offerComboSlot.createMany({
          data: [
            { offerId: created.id, position: 0, categoryId: sago.id },
            { offerId: created.id, position: 1, categoryId: mochi.id },
          ],
        });
        written();
        await held;
      },
      { timeout: 20_000 },
    );
    await partsWritten;

    const save = caller.offer.updateOffer({
      offer: {
        ...comboInput({
          comboSlots: [{ dessertId: taro.id }, { categoryId: sago.id }],
        }),
        id: created.id,
      },
    });
    const outcome = save.then(
      () => "saved",
      (error: Error) => error.message,
    );
    await Promise.race([
      outcome,
      new Promise((resolve) => setTimeout(resolve, 1_500)),
    ]);
    release();
    await otherAdmin;

    expect(await outcome).toBe("saved");
    expect(await slotsOf(created.id)).toEqual([
      { position: 0, dessertId: taro.id, categoryId: null },
      { position: 1, dessertId: null, categoryId: sago.id },
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
