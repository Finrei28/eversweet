import "server-only";

import { unstable_cache } from "next/cache";

import type { AppOffer, AppOfferAudience } from "~/lib/appOffer";
import { isOfferRunning } from "~/lib/offers";
import { db } from "~/server/db";

/**
 * The customer app's sago offer, for the website's pop-up that sends visitors to the app.
 *
 * **This is the website's first read of `Offer`.** Offers are authored on /admin/offers
 * and priced only by the order server, for the app; nothing here prices against one, and
 * this read does not change that. It decides only whether the pop-up has anything true to
 * say, and what. So it shows nothing - never a stale deal - unless the offer is:
 *
 * - **running**: switched on, not archived, inside its dates (`isOfferRunning`, the admin
 *   table's own verdict), decided at the time of the request rather than of the cached read;
 * - **on the sago category**, matched by name ("Sago Series" in production), since the
 *   words say sago bowls and an admin never sees a category's id;
 * - **a percentage off**, with no requirements to unlock it, which is what "X% off" says;
 * - **still covering a bowl** that is on the menu once its left-out desserts are taken away.
 *
 * Every column is named: the order server's copy of the schema is the same file, and a
 * column it adds that this site's client does not know would fail a read with no `select`.
 *
 * Cached for five minutes with a tag every offer write revalidates
 * (`src/server/api/routers/offers.ts`), so pausing or archiving the offer takes the pop-up
 * down at once; the five minutes cover a dessert's change on /admin/products.
 */
export const APP_OFFER_TAG = "app-offer";

/**
 * Shown when the offer has no image of its own, if the offer covers it: a bowl the shop
 * photographed well. Otherwise the first bowl it covers, by name.
 */
export const PREFERRED_BOWL = "Mango Pomelo Sago";

/**
 * One offer as the cached read keeps it. The dates are ISO strings because the Next data
 * cache does not preserve `Date` (as `getDaysOffCached` in `src/server/pickUpTimes.ts`).
 */
export type AppOfferCandidate = {
  id: string;
  image: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  archivedAt: string | null;
  audience: AppOfferAudience;
  itemPriceInCents: number | null;
  discountAmount: number | null;
  limit: number;
  renewsWeekly: boolean;
  excludedDessertIds: string[];
  requirementCount: number;
  category: {
    name: string;
    desserts: {
      id: string;
      name: string;
      imagePath: string;
      isAvailableForPurchase: boolean;
    }[];
  } | null;
};

const toDate = (iso: string | null) => (iso === null ? null : new Date(iso));

/** The offer the pop-up advertises now, if any: the biggest discount among those it may. */
export const pickAppOffer = (
  candidates: AppOfferCandidate[],
  now: Date,
): AppOffer | null => {
  const advertisable = candidates.flatMap((offer) => {
    const running = isOfferRunning(
      {
        isActive: offer.isActive,
        startsAt: toDate(offer.startsAt),
        endsAt: toDate(offer.endsAt),
        archivedAt: toDate(offer.archivedAt),
      },
      now,
    );
    const percent =
      offer.itemPriceInCents === null ? offer.discountAmount : null;
    if (
      !running ||
      percent === null ||
      offer.requirementCount > 0 ||
      !offer.category ||
      !/sago/i.test(offer.category.name)
    )
      return [];

    const covered = offer.category.desserts.filter(
      (dessert) =>
        dessert.isAvailableForPurchase &&
        !offer.excludedDessertIds.includes(dessert.id),
    );
    if (covered.length === 0) return [];

    const picture =
      offer.image ??
      (covered.find((dessert) => dessert.name === PREFERRED_BOWL) ?? covered[0])
        ?.imagePath ??
      null;
    return [
      {
        id: offer.id,
        discountPercent: percent,
        audience: offer.audience,
        limit: offer.limit,
        renewsWeekly: offer.renewsWeekly,
        endsAt: offer.endsAt,
        imageUrl: picture,
      } satisfies AppOffer,
    ];
  });

  return (
    advertisable.sort(
      (a, b) =>
        b.discountPercent - a.discountPercent || a.id.localeCompare(b.id),
    )[0] ?? null
  );
};

const readCandidates = unstable_cache(
  async (): Promise<AppOfferCandidate[]> => {
    const rows = await db.offer.findMany({
      // Narrowed in the database to what could run; `pickAppOffer` decides the rest.
      where: { archivedAt: null, isActive: true, categoryId: { not: null } },
      select: {
        id: true,
        image: true,
        isActive: true,
        startsAt: true,
        endsAt: true,
        archivedAt: true,
        audience: true,
        itemPriceInCents: true,
        discountAmount: true,
        limit: true,
        renewsWeekly: true,
        excludedDessertIds: true,
        _count: { select: { requirements: true } },
        category: {
          select: {
            name: true,
            desserts: {
              select: {
                id: true,
                name: true,
                imagePath: true,
                isAvailableForPurchase: true,
              },
              orderBy: { name: "asc" },
            },
          },
        },
      },
      relationLoadStrategy: "join",
    });

    return rows.map(({ _count, ...offer }) => ({
      ...offer,
      startsAt: offer.startsAt?.toISOString() ?? null,
      endsAt: offer.endsAt?.toISOString() ?? null,
      archivedAt: offer.archivedAt?.toISOString() ?? null,
      requirementCount: _count.requirements,
    }));
  },
  [APP_OFFER_TAG],
  { revalidate: 300, tags: [APP_OFFER_TAG] },
);

/**
 * Never throws. A failed read shows nothing: the only cost is a pop-up not shown, which can
 * never advertise something untrue.
 */
export const getAppOffer = async (
  now: Date = new Date(),
): Promise<AppOffer | null> => {
  try {
    return pickAppOffer(await readCandidates(), now);
  } catch (error) {
    console.error("Could not read the app offer:", error);
    return null;
  }
};
