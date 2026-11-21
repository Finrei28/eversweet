/**
 * The website's first read of `Offer`, against a real Postgres: the query the app-offer
 * pop-up makes, with its explicit select, read back through the same rules the unit suite
 * pins.
 *
 * Skips when TEST_DATABASE_URL is unset; see `src/test/db.ts`.
 */
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// No Next request scope in a test, so no data cache either: read straight through.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { db } from "~/server/db";
import { describeIfDb, resetDatabase } from "~/test/db";

import { getAppOffer } from "./appOffer";

/** The Sago Series as production has it, in brief: the Durian Sago is the one left out. */
const seedSago = async () => {
  const category = await db.category.create({
    data: { name: "Sago Series", chineseName: "西米露系列" },
  });
  const bowl = (name: string, chineseName: string) =>
    db.dessert.create({
      data: {
        name,
        chineseName,
        priceInCents: 1199,
        imagePath: `https://res.cloudinary.com/dlqjgl6ju/image/upload/${name.replace(/\W+/g, "")}.jpg`,
        imagePublicId: `products/${name}`,
        isAvailableForPurchase: true,
        categoryId: category.id,
      },
    });
  const durian = await bowl("Durian Sago with Milk Pudding", "榴莲河粉西米露");
  const mango = await bowl("Mango Pomelo Sago", "杨枝甘露");
  await bowl("Red Bean Sago", "红豆西米露");
  return { category, durian, mango };
};

describeIfDb("getAppOffer", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("reads the running sago offer, as the app will price it", async () => {
    const { category, durian, mango } = await seedSago();
    const offer = await db.offer.create({
      data: {
        name: "50% off sago bowls for new users",
        audience: "NEW_USERS",
        categoryId: category.id,
        excludedDessertIds: [durian.id],
        discountAmount: 50,
        limit: 1,
      },
    });

    await expect(getAppOffer()).resolves.toEqual({
      id: offer.id,
      discountPercent: 50,
      audience: "NEW_USERS",
      limit: 1,
      renewsWeekly: false,
      imageUrl: mango.imagePath,
    });
  });

  it("finds nothing once the offer is archived or past its last day", async () => {
    const { category } = await seedSago();
    await db.offer.create({
      data: {
        name: "Archived",
        audience: "EVERYONE",
        categoryId: category.id,
        discountAmount: 50,
        archivedAt: new Date(),
      },
    });
    await db.offer.create({
      data: {
        name: "Ended",
        audience: "EVERYONE",
        categoryId: category.id,
        discountAmount: 50,
        endsAt: new Date(Date.now() - 1000),
      },
    });

    await expect(getAppOffer()).resolves.toBeNull();
  });

  it("passes over an offer that must be unlocked first", async () => {
    const { category, mango } = await seedSago();
    await db.offer.create({
      data: {
        name: "Buy two, get one half price",
        audience: "EVERYONE",
        categoryId: category.id,
        discountAmount: 50,
        requirements: { create: { dessertId: mango.id, quantity: 2 } },
      },
    });

    await expect(getAppOffer()).resolves.toBeNull();
  });
});
