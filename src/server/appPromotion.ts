import "server-only";

import { unstable_cache } from "next/cache";

import { db } from "~/server/db";

/**
 * What the website's app promotions - the home page's band and the card under a website
 * order - may claim about the customer app right now.
 *
 * Three of their claims are settings the shop edits on /admin/settings, so they can stop
 * being true without a deploy:
 * - **Points are earned** unless the rate or the modifier is 0, both of which are legal and
 *   documented as switching earning off.
 * - **Members earn more** only above a member bonus of 100% (1x), the lowest it can be set.
 *   No earning, no member bonus either.
 * - **The leaderboard** is shown in the app until it is hidden, and it ranks points earned
 *   in the month, so with earning off there is nobody on it.
 *
 * Cached at module scope with a tag the loyalty-rates save and the leaderboard switch both
 * revalidate, like the shop profile, because the home page is meant to render without a
 * database round trip. The five minutes are only a backstop for a write that missed the tag.
 */
export const APP_PROMOTION_TAG = "app-promotion";

export type AppPromotion = {
  pointsEarned: boolean;
  memberRateHigher: boolean;
  leaderboardShown: boolean;
};

/** Nothing claimed: the answer to a read that failed. */
const CLAIM_NOTHING: AppPromotion = {
  pointsEarned: false,
  memberRateHigher: false,
  leaderboardShown: false,
};

const getAppPromotionCached = unstable_cache(
  async (): Promise<AppPromotion> => {
    const row = await db.loyaltySetting.findFirst({
      select: {
        pointsPerDollar: true,
        memberBonusPercent: true,
        modifierPercent: true,
        leaderboardHiddenAt: true,
      },
    });
    // No row is what the order server reads as its DEFAULT_LOYALTY_RATES (6 a dollar, 1.5x
    // for members, a 1x modifier) and a shown board, which are also the column defaults.
    const pointsPerDollar = row?.pointsPerDollar ?? 6;
    const memberBonusPercent = row?.memberBonusPercent ?? 150;
    const modifierPercent = row?.modifierPercent ?? 100;

    const pointsEarned = pointsPerDollar > 0 && modifierPercent > 0;
    return {
      pointsEarned,
      memberRateHigher: pointsEarned && memberBonusPercent > 100,
      leaderboardShown: pointsEarned && !row?.leaderboardHiddenAt,
    };
  },
  [APP_PROMOTION_TAG],
  { revalidate: 300, tags: [APP_PROMOTION_TAG] },
);

/**
 * Never throws. A failed read claims nothing: the order server treats an unreadable setting
 * as its defaults so as not to take anything from customers, but here the only cost of
 * leaving a line out is a line of advertising, which can never be untrue.
 */
export const getAppPromotion = async (): Promise<AppPromotion> => {
  try {
    return await getAppPromotionCached();
  } catch (error) {
    console.error("Could not read what the app promotion may claim:", error);
    return CLAIM_NOTHING;
  }
};
