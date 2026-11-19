import "server-only";

import { unstable_cache } from "next/cache";

import { db } from "~/server/db";

/**
 * Whether the customer app is showing the monthly leaderboard right now, for the home page's
 * app band, which mentions it only while it is.
 *
 * `/admin/settings` can hide the board (`LoyaltySetting.leaderboardHiddenAt`), and the order
 * server then takes it, and last month's podium, out of the app. A website still advertising
 * it would be promising something the app no longer shows.
 *
 * Cached at module scope with a tag `setLeaderboardVisibility` revalidates, like the shop
 * profile, because the home page is meant to render without a database round trip. The five
 * minutes are only a backstop for a write that missed the tag.
 */
export const LEADERBOARD_VISIBILITY_TAG = "leaderboard-visibility";

const isLeaderboardShownCached = unstable_cache(
  async (): Promise<boolean> => {
    const row = await db.loyaltySetting.findFirst({
      select: { leaderboardHiddenAt: true },
    });
    // No row at all is shown in the app, so it is shown here.
    return !row?.leaderboardHiddenAt;
  },
  [LEADERBOARD_VISIBILITY_TAG],
  { revalidate: 300, tags: [LEADERBOARD_VISIBILITY_TAG] },
);

/**
 * Never throws. On a failed read the line is left out: the order server treats an unreadable
 * setting as shown so as not to take the board from customers, but here the only cost of
 * leaving it out is one line of advertising, which can never be untrue.
 */
export const isLeaderboardShown = async (): Promise<boolean> => {
  try {
    return await isLeaderboardShownCached();
  } catch (error) {
    console.error("Could not read whether the leaderboard is shown:", error);
    return false;
  }
};
