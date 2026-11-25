import { Prisma } from "@prisma/client";
import { beforeEach, expect, it } from "vitest";

import { db } from "~/server/db";
import { describeIfDb, resetDatabase } from "~/test/db";

/**
 * Combo offers as the database stores them (20261125000000_offer_combos): one price for the
 * set, slots naming a dessert or a category, and a `comboId` grouping a combo's cart and
 * order lines. The order server prices and checks combos; this repo authors them.
 */
describeIfDb("combo offers in the database", () => {
  let categoryId: string;
  let dessertId: string;

  beforeEach(async () => {
    await resetDatabase();
    const category = await db.category.create({
      data: { name: "Sago Series", chineseName: "西米系列" },
    });
    categoryId = category.id;
    const dessert = await db.dessert.create({
      data: {
        name: "Mango sago",
        chineseName: "芒果西米露",
        priceInCents: 1200,
        imagePath: "/desserts/mango-sago.jpg",
        imagePublicId: "products/mango-sago",
        categoryId,
      },
    });
    dessertId = dessert.id;
  });

  const makeCombo = () =>
    db.offer.create({
      data: {
        name: "Any two sago",
        comboPriceInCents: 1500,
        comboSlots: {
          create: [
            { position: 0, categoryId },
            { position: 1, categoryId },
          ],
        },
      },
      select: {
        comboPriceInCents: true,
        dessertId: true,
        categoryId: true,
        comboSlots: {
          select: { position: true, dessertId: true, categoryId: true },
          orderBy: { position: "asc" },
        },
      },
    });

  it("stores a combo's price and slots, the same category twice", async () => {
    expect(await makeCombo()).toEqual({
      comboPriceInCents: 1500,
      dessertId: null,
      categoryId: null,
      comboSlots: [
        { position: 0, dessertId: null, categoryId },
        { position: 1, dessertId: null, categoryId },
      ],
    });
  });

  it("refuses two slots at the same position", async () => {
    const offer = await db.offer.create({
      data: { name: "Pair", comboPriceInCents: 1500 },
    });
    await db.offerComboSlot.create({
      data: { offerId: offer.id, position: 0, categoryId },
    });

    await expect(
      db.offerComboSlot.create({
        data: { offerId: offer.id, position: 0, dessertId },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("refuses to delete a dessert a slot names", async () => {
    const offer = await db.offer.create({
      data: { name: "Pair", comboPriceInCents: 1500 },
    });
    await db.offerComboSlot.create({
      data: { offerId: offer.id, position: 0, dessertId },
    });

    await expect(
      db.dessert.delete({ where: { id: dessertId } }),
    ).rejects.toThrow();
  });

  it("groups a combo's cart lines by comboId", async () => {
    const offer = await db.offer.create({
      data: { name: "Pair", comboPriceInCents: 1500 },
    });
    const user = await db.user.create({
      data: { email: "combo@example.com", password: "x", role: "USER" },
    });
    await db.cart.create({
      data: {
        userId: user.id,
        cartItems: {
          create: [0, 1].map(() => ({
            dessertId,
            offerId: offer.id,
            comboId: "combo-1",
            quantity: 1,
            itemPriceInCents: 1200,
            discountedAmountInCents: 450,
          })),
        },
      },
    });

    expect(
      await db.cartItem.count({ where: { comboId: "combo-1" } }),
    ).toBe(2);
  });

  // The migration's CHECK constraints, which Prisma cannot see. A test database built with
  // `prisma db push` has none, and the suites promise to pass on one - so these skip, in
  // the report rather than silently, until the constraints are applied (see CLAUDE.md).
  const constraintsInstalled = async () => {
    const [row] = await db.$queryRaw<{ installed: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Offer_combo_names_no_dessert'
      ) AS installed
    `;
    return Boolean(row?.installed);
  };

  it.for([
    [
      "a combo with a fixed price as well",
      () => ({ name: "x", comboPriceInCents: 1500, itemPriceInCents: 500 }),
    ],
    [
      "a combo with a percentage as well",
      () => ({ name: "x", comboPriceInCents: 1500, discountAmount: 20 }),
    ],
    ["a negative combo price", () => ({ name: "x", comboPriceInCents: -1 })],
    [
      "a combo naming a category of its own",
      () => ({ name: "x", comboPriceInCents: 1500, categoryId }),
    ],
    [
      "a combo leaving desserts out",
      () => ({
        name: "x",
        comboPriceInCents: 1500,
        excludedDessertIds: [dessertId],
      }),
    ],
  ] as const)("the table refuses %s", async ([, data], { skip }) => {
    if (!(await constraintsInstalled())) skip();

    await expect(db.offer.create({ data: data() })).rejects.toThrow(
      Prisma.PrismaClientUnknownRequestError,
    );
  });

  it.for([
    ["a slot naming nothing", () => ({ position: 0 })],
    [
      "a slot naming a dessert and a category",
      () => ({ position: 0, dessertId, categoryId }),
    ],
    ["a fifth slot", () => ({ position: 4, categoryId })],
  ] as const)("the table refuses %s", async ([, slot], { skip }) => {
    if (!(await constraintsInstalled())) skip();
    const offer = await db.offer.create({
      data: { name: "Pair", comboPriceInCents: 1500 },
    });

    await expect(
      db.offerComboSlot.create({ data: { offerId: offer.id, ...slot() } }),
    ).rejects.toThrow(Prisma.PrismaClientUnknownRequestError);
  });

  it.for([
    ["with no offer", { offerId: null, quantity: 1, loyaltyPointsUsed: null }],
    ["two at once", { quantity: 2, loyaltyPointsUsed: null }],
    ["paid with points", { quantity: 1, loyaltyPointsUsed: 500 }],
  ] as const)(
    "the table refuses a combo cart line %s",
    async ([, line], { skip }) => {
      if (!(await constraintsInstalled())) skip();
      const offer = await db.offer.create({
        data: { name: "Pair", comboPriceInCents: 1500 },
      });
      const user = await db.user.create({
        data: { email: "combo@example.com", password: "x", role: "USER" },
      });
      const cart = await db.cart.create({ data: { userId: user.id } });

      await expect(
        db.cartItem.create({
          data: {
            cartId: cart.id,
            dessertId,
            offerId: offer.id,
            comboId: "combo-1",
            itemPriceInCents: 1200,
            ...line,
          },
        }),
      ).rejects.toThrow(Prisma.PrismaClientUnknownRequestError);
    },
  );
});
