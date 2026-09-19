import "server-only";

import { unstable_cache } from "next/cache";

import { DEFAULT_SHOP_PROFILE, type ShopProfile } from "~/lib/shopSettings";
import { db } from "~/server/db";

/**
 * The shop's own details, from the `ShopProfile` table the order server also reads.
 *
 * They used to be written out in five places across the two repos, in two different
 * formats, so a change meant finding all of them. This is the website's half of the fix;
 * `backend/src/lib/storeInfo.ts` is the other.
 *
 * Cached at module scope so the wrapper is built once rather than per request, with a tag
 * the settings router revalidates on save. Same arrangement as the prep times and the
 * trading hours in `~/server/pickUpTimes`.
 */
export const SHOP_PROFILE_TAG = "shop-profile";

const getShopProfileCached = unstable_cache(
  async (): Promise<ShopProfile> => {
    const row = await db.shopProfile.findFirst({
      select: {
        name: true,
        address: true,
        city: true,
        state: true,
        postal: true,
        phone: true,
        email: true,
        website: true,
      },
    });

    return row ?? DEFAULT_SHOP_PROFILE;
  },
  [SHOP_PROFILE_TAG],
  { revalidate: 300, tags: [SHOP_PROFILE_TAG] },
);

export const getShopProfile = async (): Promise<ShopProfile> => {
  try {
    return await getShopProfileCached();
  } catch (error) {
    console.error("Could not read the shop's details:", error);
    return DEFAULT_SHOP_PROFILE;
  }
};
