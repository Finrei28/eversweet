import { notFound } from "next/navigation";
import { Suspense } from "react";

import Loader from "~/app/components/customLoading";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { DataTable } from "./data-table";

export default async function OffersPage() {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  /**
   * Awaited rather than `void`-ed, and in parallel.
   *
   * getOffers is called bare on both sides so its input default applies identically -
   * prefetch and useSuspenseQuery must agree exactly or the cache key misses.
   *
   * A pending dehydrated promise makes the Suspense boundary suspend on the server, so
   * its content streams in after the shell - and streamed-in content gets `useId` tree
   * ids that do not match the ones hydration computes, which broke every Radix id
   * inside. See the long note in src/app/admin/past-orders/page.tsx.
   *
   * Promise.all rather than separate awaits: these are independent queries and each is
   * a round trip to a remote database, so awaiting them in sequence would stack the
   * latency into the shell.
   */
  await Promise.all([
    api.offer.getOffers.prefetch(),
    api.dessert.getProducts.prefetch(),
    api.dessert.getCategories.prefetch(),
  ]);

  return (
    <HydrateClient>
      <div className="container mx-auto py-10">
        <Suspense fallback={<Loader text="Loading offers..." />}>
          <DataTable />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
