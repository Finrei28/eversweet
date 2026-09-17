/**
 * The offer admin write paths, against a real Postgres.
 *
 * These exist for one reason: every guarantee the run lifecycle makes is a statement
 * about rows, and a mocked `ctx.db` could only ever assert that the mock was called.
 * Two of them are invisible from the UI and would regress silently -
 *
 * - `updateOffer` patches an `OfferRequirement` rather than deleting and recreating it,
 *   so its id survives an unrelated edit. The order server reads those rows on every
 *   eligibility check.
 * - `closeRun` is the *only* procedure that touches a redemption. Editing, pausing,
 *   resuming, archiving and restoring must all leave one alone, or an admin fixing a
 *   typo silently re-grants an offer to everyone who has already used it.
 *
 * Skips when TEST_DATABASE_URL is unset; see `src/test/db.ts`.
 */
import { beforeEach, expect, it, vi } from "vitest";

// `orderServer` is `server-only`, which throws outside an RSC, and `trpc.ts` imports
// `~/server/auth` -> next-auth -> `next/server`, which will not resolve under Vitest. A
// server-side caller never calls `auth()`, so the stub costs nothing.
vi.mock("server-only", () => ({}));
vi.mock("~/server/auth", () => ({ auth: vi.fn(async () => null) }));

import { DateTime, Settings } from "luxon";
import type { z } from "zod";

import type { createOfferSchema } from "~/app/components/schemas";
import { endOfDayNZ } from "~/lib/aucklandDay";
import { db } from "~/server/db";
import { adminCaller } from "~/test/caller";
import { describeIfDb, resetDatabase } from "~/test/db";

type OfferInput = z.input<typeof createOfferSchema>;

/** A day on the Auckland calendar, counted from today, the way the dialog sends one. */
const aucklandDay = (offset: number) =>
  DateTime.now()
    .setZone("Pacific/Auckland")
    .plus({ days: offset })
    .toFormat("yyyy-LL-dd");

const offerInput = (overrides: Partial<OfferInput> = {}): OfferInput => ({
  name: "Free mochi bowl",
  // Deliberately absent rather than null: `description` is `.optional()` on the schema,
  // not `.nullable()`, and the router maps the undefined to null on the way in.
  image: null,
  isActive: true,
  startsOn: null,
  endsOn: null,
  audience: "MEMBERS",
  dessertId: null,
  categoryId: null,
  // Exactly one price is now required, so the fixture carries a discount and the tests
  // that care about a fixed price swap it for one.
  itemPriceInCents: null,
  discountAmount: 50,
  limit: 1,
  renewsWeekly: false,
  requirements: [],
  ...overrides,
});

/**
 * Two desserts at different prices, because the price ceiling is the *cheapest* item an
 * offer covers. With one dessert the category branch and the dessert branch would agree
 * on every input and the rule would look correct while being wrong.
 */
const seedMenu = async () => {
  const category = await db.category.create({
    data: { name: "Mochi bowls", chineseName: "麻糬碗" },
  });

  const makeDessert = (name: string, chineseName: string, priceInCents: number) =>
    db.dessert.create({
      data: {
        name,
        chineseName,
        priceInCents,
        imagePath: `/desserts/${name}.jpg`,
        imagePublicId: `products/${name}`,
        categoryId: category.id,
      },
    });

  const dessert = await makeDessert("Mango sago", "芒果西米露", 1200);
  const cheaper = await makeDessert("Taro balls", "芋圆", 900);

  return { category, dessert, cheaper };
};

let customers = 0;
const seedCustomer = () =>
  db.user.create({
    data: {
      email: `customer${++customers}@eversweet.test`,
      password: "not-a-real-hash",
      role: "USER",
    },
  });

/**
 * `timingMiddleware` sleeps 100-500ms per call whenever `isDev`, and Vitest sets
 * NODE_ENV=test rather than production, so every procedure call here pays it. The
 * multi-step lifecycle cases make five or six calls and would otherwise flake against
 * the 5s default.
 */
describeIfDb("offer router", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetDatabase();
    customers = 0;
  });

  it("round-trips a created offer through the read path", async () => {
    const { dessert } = await seedMenu();
    const caller = adminCaller();
    const endsOn = aucklandDay(2);

    await caller.offer.createOffer({
      offer: offerInput({
        name: "Winter warmer",
        description: "Half price taro",
        dessertId: dessert.id,
        discountAmount: 50,
        limit: 3,
        renewsWeekly: true,
        endsOn,
        requirements: [{ dessertId: dessert.id, quantity: 2 }],
      }),
    });

    const [offer] = await caller.offer.getOffers();

    expect(offer).toMatchObject({
      name: "Winter warmer",
      description: "Half price taro",
      limit: 3,
      renewsWeekly: true,
      endsAt: endOfDayNZ(endsOn),
      dessert: { id: dessert.id, name: "Mango sago" },
      _count: { redemptions: 0 },
    });

    // The point of the 2026-09-12 migration: a Decimal would arrive as an object, and
    // as a fraction 50 would have meant 5000%. Both apps now read this as whole percent.
    expect(offer?.discountAmount).toBe(50);
    expect(typeof offer?.discountAmount).toBe("number");

    expect(offer?.requirements).toMatchObject([
      { quantity: 2, dessert: { id: dessert.id } },
    ]);
  });

  /**
   * The bug this shape exists for. The dialog used to send the calendar's `Date`, which
   * is midnight at the *start* of the day picked, and the router stored it as it came: an
   * offer set to end on the 31st stopped as the 31st began. Played on a UTC host, as on
   * Vercel, so reading the day off anything on the server would show up here.
   */
  it("stores the dates as the whole of those days in Auckland, even on a UTC host", async () => {
    const previous = Settings.defaultZone;
    Settings.defaultZone = "UTC";

    try {
      const created = await adminCaller().offer.createOffer({
        offer: offerInput({ startsOn: "2026-10-01", endsOn: "2026-10-31" }),
      });

      await expect(
        db.offer.findUnique({
          where: { id: created.id },
          select: { startsAt: true, endsAt: true },
        }),
      ).resolves.toEqual({
        // Midnight on 1 October and the last millisecond of 31 October, NZDT.
        startsAt: new Date("2026-09-30T11:00:00.000Z"),
        endsAt: new Date("2026-10-31T10:59:59.999Z"),
      });
    } finally {
      Settings.defaultZone = previous;
    }
  });

  it("refuses a date that is not a calendar day", async () => {
    await expect(
      adminCaller().offer.createOffer({
        offer: offerInput({ endsOn: "2026-02-30" }),
      }),
    ).rejects.toThrow();

    await expect(db.offer.count()).resolves.toBe(0);
  });

  it("returns archived offers too, so the table can filter them client-side", async () => {
    const caller = adminCaller();
    const live = await caller.offer.createOffer({
      offer: offerInput({ name: "Live one" }),
    });
    const archived = await caller.offer.createOffer({
      offer: offerInput({ name: "Archived one" }),
    });
    await caller.offer.setArchived({ id: archived.id, archived: true });

    const offers = await caller.offer.getOffers();

    // This is the "Show archived" bug: the procedure used to take an includeArchived
    // flag defaulting to false, so the archived rows never arrived and the toggle
    // filtered a list that already had none in it.
    expect(offers.map((o) => o.id).sort()).toEqual(
      [live.id, archived.id].sort(),
    );
  });

  it("patches requirements in place rather than recreating them", async () => {
    const { category, dessert } = await seedMenu();
    const caller = adminCaller();

    const created = await caller.offer.createOffer({
      offer: offerInput({
        requirements: [
          { dessertId: dessert.id, quantity: 2 },
          { categoryId: category.id, quantity: 3 },
        ],
      }),
    });

    const before = await db.offerRequirement.findMany({
      where: { offerId: created.id },
      select: { id: true, dessertId: true, categoryId: true },
    });

    const kept = before.find((r) => r.dessertId === dessert.id);
    const dropped = before.find((r) => r.categoryId === category.id);
    if (!kept || !dropped) throw new Error("seeded requirements missing");

    await caller.offer.updateOffer({
      offer: {
        ...offerInput({
          requirements: [{ id: kept.id, dessertId: dessert.id, quantity: 5 }],
        }),
        id: created.id,
      },
    });

    const after = await db.offerRequirement.findMany({
      where: { offerId: created.id },
      select: { id: true, quantity: true },
    });

    // The id is the assertion. Delete-and-recreate would pass every other check here
    // while quietly handing the order server a row it has never seen.
    expect(after).toEqual([{ id: kept.id, quantity: 5 }]);
    await expect(
      db.offerRequirement.findUnique({ where: { id: dropped.id } }),
    ).resolves.toBeNull();
  });

  it("adds a new requirement without disturbing the existing one", async () => {
    const { category, dessert } = await seedMenu();
    const caller = adminCaller();

    const created = await caller.offer.createOffer({
      offer: offerInput({
        requirements: [{ dessertId: dessert.id, quantity: 2 }],
      }),
    });

    const [existing] = await db.offerRequirement.findMany({
      where: { offerId: created.id },
      select: { id: true },
    });
    if (!existing) throw new Error("seeded requirement missing");

    await caller.offer.updateOffer({
      offer: {
        ...offerInput({
          requirements: [
            { id: existing.id, dessertId: dessert.id, quantity: 2 },
            { categoryId: category.id, quantity: 4 },
          ],
        }),
        id: created.id,
      },
    });

    const after = await db.offerRequirement.findMany({
      where: { offerId: created.id },
      select: { id: true, quantity: true, categoryId: true },
    });

    expect(after).toHaveLength(2);
    expect(after.map((r) => r.id)).toContain(existing.id);
    expect(after).toContainEqual(
      expect.objectContaining({ quantity: 4, categoryId: category.id }),
    );
  });

  it("refuses to edit an offer whose run has ended, and changes nothing", async () => {
    const caller = adminCaller();
    const created = await caller.offer.createOffer({
      offer: offerInput({ name: "Ended run", endsOn: aucklandDay(-1) }),
    });

    await expect(
      caller.offer.updateOffer({
        offer: {
          // Pushing the end date forward is exactly the move the guard exists to stop:
          // it would take the offer live again with nobody's redemption cleared, and the
          // edit destroys the evidence the run had ended, so no later check could tell.
          ...offerInput({ name: "Renamed", endsOn: aucklandDay(2) }),
          id: created.id,
        },
      }),
    ).rejects.toThrow(/Close the run first/);

    await expect(
      db.offer.findUnique({
        where: { id: created.id },
        select: { name: true },
      }),
    ).resolves.toEqual({ name: "Ended run" });
  });

  it("refuses to reactivate an offer whose run has ended", async () => {
    const caller = adminCaller();
    const created = await caller.offer.createOffer({
      offer: offerInput({ isActive: false, endsOn: aucklandDay(-1) }),
    });

    await expect(
      caller.offer.setActive({ id: created.id, active: true }),
    ).rejects.toThrow(/Close the run/);
  });

  it("leaves a redemption untouched through edit, pause, resume, archive and restore", async () => {
    const { dessert } = await seedMenu();
    const user = await seedCustomer();
    const caller = adminCaller();

    const created = await caller.offer.createOffer({
      offer: offerInput({
        endsOn: aucklandDay(3),
        requirements: [{ dessertId: dessert.id, quantity: 2 }],
      }),
    });

    const [requirement] = await db.offerRequirement.findMany({
      where: { offerId: created.id },
      select: { id: true },
    });
    if (!requirement) throw new Error("seeded requirement missing");

    // OfferStatus has no @default, so it is always set explicitly.
    const seeded = await db.offerRedemption.create({
      data: {
        offerId: created.id,
        userId: user.id,
        status: "REDEEMED",
        used: 1,
      },
    });

    const snapshot = () =>
      db.offerRedemption.findUnique({ where: { id: seeded.id } });

    const rename = (name: string) =>
      caller.offer.updateOffer({
        offer: {
          ...offerInput({
            name,
            endsOn: aucklandDay(3),
            requirements: [
              { id: requirement.id, dessertId: dessert.id, quantity: 2 },
            ],
          }),
          id: created.id,
        },
      });

    await rename("Renamed once");
    await expect(snapshot()).resolves.toEqual(seeded);

    await caller.offer.setActive({ id: created.id, active: false });
    await expect(snapshot()).resolves.toEqual(seeded);

    await caller.offer.setActive({ id: created.id, active: true });
    await expect(snapshot()).resolves.toEqual(seeded);

    await caller.offer.setArchived({ id: created.id, archived: true });
    await expect(snapshot()).resolves.toEqual(seeded);

    await caller.offer.setArchived({ id: created.id, archived: false });
    await expect(snapshot()).resolves.toEqual(seeded);
  });

  it("refuses an offer that sets both a fixed price and a discount", async () => {
    const caller = adminCaller();

    // Both set used to be accepted and the discount silently ignored, so a row could
    // read "50% off" while every customer was charged the fixed price.
    await expect(
      caller.offer.createOffer({
        offer: offerInput({ itemPriceInCents: 500, discountAmount: 20 }),
      }),
    ).rejects.toThrow(/not both/);
  });

  it("refuses an offer that sets neither a fixed price nor a discount", async () => {
    const caller = adminCaller();

    await expect(
      caller.offer.createOffer({
        offer: offerInput({ itemPriceInCents: null, discountAmount: null }),
      }),
    ).rejects.toThrow(/needs one of them/);
  });

  it("refuses a discount outside 1-100", async () => {
    const caller = adminCaller();

    for (const discountAmount of [0, 101]) {
      await expect(
        caller.offer.createOffer({ offer: offerInput({ discountAmount }) }),
      ).rejects.toThrow();
    }
  });

  it("holds a fixed price under the cheapest item in the category", async () => {
    const { category, cheaper } = await seedMenu();
    const caller = adminCaller();

    // 950 is under Mango sago at 1200 but not under Taro balls at 900, and the offer
    // covers both. Taking the ceiling from the wrong dessert would let this through.
    await expect(
      caller.offer.createOffer({
        offer: offerInput({
          categoryId: category.id,
          itemPriceInCents: 950,
          discountAmount: null,
        }),
      }),
    ).rejects.toThrow(new RegExp(cheaper.name));

    await expect(
      caller.offer.createOffer({
        offer: offerInput({
          categoryId: category.id,
          itemPriceInCents: 899,
          discountAmount: null,
        }),
      }),
    ).resolves.toMatchObject({ name: "Free mochi bowl" });
  });

  it("refuses a fixed price equal to the list price, and allows free", async () => {
    const { dessert } = await seedMenu();
    const caller = adminCaller();

    // Equal is not an offer.
    await expect(
      caller.offer.createOffer({
        offer: offerInput({
          dessertId: dessert.id,
          itemPriceInCents: dessert.priceInCents,
          discountAmount: null,
        }),
      }),
    ).rejects.toThrow(/under what the item normally costs/);

    // Zero is how both of the shop's giveaway offers are stored, so it has to stay
    // legal - a "positive integer" rule would have made them unsaveable.
    await expect(
      caller.offer.createOffer({
        offer: offerInput({
          name: "Free bowl",
          dessertId: dessert.id,
          itemPriceInCents: 0,
          discountAmount: null,
        }),
      }),
    ).resolves.toMatchObject({ name: "Free bowl" });
  });

  it("holds the price ceiling on edit as well as on create", async () => {
    const { category } = await seedMenu();
    const caller = adminCaller();

    const created = await caller.offer.createOffer({
      offer: offerInput({
        categoryId: category.id,
        itemPriceInCents: 500,
        discountAmount: null,
      }),
    });

    await expect(
      caller.offer.updateOffer({
        offer: {
          ...offerInput({
            categoryId: category.id,
            itemPriceInCents: 5000,
            discountAmount: null,
          }),
          id: created.id,
        },
      }),
    ).rejects.toThrow(/under what the item normally costs/);

    // The transaction rolled back, so the stored price is untouched.
    await expect(
      db.offer.findUnique({
        where: { id: created.id },
        select: { itemPriceInCents: true },
      }),
    ).resolves.toEqual({ itemPriceInCents: 500 });
  });

  // Ending today on purpose: an offer is served through the whole of its last day, so a
  // run ending today has not ended. Stored as midnight, it had ended hours ago.
  it("refuses to close a run that ends today", async () => {
    const caller = adminCaller();
    const created = await caller.offer.createOffer({
      offer: offerInput({ endsOn: aucklandDay(0) }),
    });

    await expect(caller.offer.closeRun({ id: created.id })).rejects.toThrow(
      /has not ended yet/,
    );
  });

  it("closes a finished run: deletes redemptions, clears the end date, unblocks editing", async () => {
    const { dessert } = await seedMenu();
    const one = await seedCustomer();
    const two = await seedCustomer();
    const caller = adminCaller();

    const created = await caller.offer.createOffer({
      offer: offerInput({
        name: "First run",
        endsOn: aucklandDay(-1),
        requirements: [{ dessertId: dessert.id, quantity: 2 }],
      }),
    });

    await db.offerRedemption.createMany({
      data: [
        { offerId: created.id, userId: one.id, status: "REDEEMED", used: 1 },
        { offerId: created.id, userId: two.id, status: "AVAILABLE", used: 0 },
      ],
    });

    const result = await caller.offer.closeRun({ id: created.id });

    expect(result).toEqual({ name: "First run", redemptionsCleared: 2 });
    await expect(
      db.offerRedemption.count({ where: { offerId: created.id } }),
    ).resolves.toBe(0);
    await expect(
      db.offer.findUnique({
        where: { id: created.id },
        select: { isActive: true, endsAt: true },
      }),
    ).resolves.toEqual({ isActive: false, endsAt: null });

    // The requirements must survive. Deleting the redemptions is what makes customers
    // earn the offer again, and that only means anything while the gate still exists.
    const [requirement] = await db.offerRequirement.findMany({
      where: { offerId: created.id },
      select: { id: true },
    });
    if (!requirement) throw new Error("closeRun destroyed the requirements");

    // Clearing endsAt is what lifts the edit block, so the next run can be dated.
    await caller.offer.updateOffer({
      offer: {
        ...offerInput({
          name: "Second run",
          endsOn: aucklandDay(2),
          requirements: [
            { id: requirement.id, dessertId: dessert.id, quantity: 2 },
          ],
        }),
        id: created.id,
      },
    });

    await expect(
      db.offer.findUnique({
        where: { id: created.id },
        select: { name: true },
      }),
    ).resolves.toEqual({ name: "Second run" });
  });
});
