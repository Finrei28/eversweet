import { notFound } from "next/navigation";
import { Suspense } from "react";

import Loader from "~/app/components/customLoading";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { DataTable } from "./data-table";

export default async function WinnersPage() {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  // Awaited rather than `void`-ed so the Suspense boundary below does not suspend on
  // the server. A pending dehydrated promise makes React stream the boundary's content
  // in after the shell, and streamed-in content gets `useId` tree ids that do not match
  // the ones hydration computes - which broke every Radix id inside the table. See the
  // long note in src/app/admin/past-orders/page.tsx.
  await api.winner.getWinners.prefetch();

  return (
    <HydrateClient>
      <div className="container mx-auto py-10">
        <Suspense
          fallback={
            <Loader
              text={{ en: "Loading winners...", zh: "正在加载得奖者..." }}
            />
          }
        >
          <DataTable />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
