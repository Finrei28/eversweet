import { notFound } from "next/navigation";
import { Suspense } from "react";

import Loader from "~/app/components/customLoading";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { SettingsPanels } from "./_components/settingsPanels";

/**
 * The shop settings that used to need a deploy to change: what an order earns, what the
 * membership advertises, what the launch pop-up says, and the shop's own details.
 *
 * Preparation times are deliberately not here - they stay in the staff app, where the
 * kitchen adjusts them as service speeds up or slows down. These are the ones that should
 * not be changeable from the tablet on the counter.
 */
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  // Awaited rather than `void`-ed so the Suspense boundary below does not suspend on the
  // server. A pending dehydrated promise makes React stream the boundary's content in
  // after the shell, and streamed-in content gets `useId` tree ids that do not match the
  // ones hydration computes. See the long note in src/app/admin/past-orders/page.tsx.
  await Promise.all([
    api.settings.getLoyaltyRates.prefetch(),
    api.settings.getPointsExpiry.prefetch(),
    api.settings.getShopProfile.prefetch(),
    api.settings.getMembershipBenefits.prefetch(),
    // `{}` matches the card's useSuspenseQuery({}) exactly. A prefetch whose input differs
    // misses the cache key entirely, which is the same as not prefetching at all.
    api.settings.getSettingsWarnings.prefetch({}),
    api.settings.getAnnouncements.prefetch(),
  ]);

  return (
    <HydrateClient>
      <div className="container mx-auto py-10">
        <Suspense
          fallback={
            <Loader
              text={{ en: "Loading settings...", zh: "正在加载设置..." }}
            />
          }
        >
          <SettingsPanels />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
