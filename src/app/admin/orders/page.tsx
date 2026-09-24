import { DataTable } from "./data-table";
import { auth } from "~/server/auth";
import { notFound } from "next/navigation";
import { api, HydrateClient } from "~/trpc/server";
import { Suspense } from "react";
import Loading from "./loading";

export default async function PastOrdersPage() {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  // Awaited rather than `void`-ed so the Suspense boundary below does not suspend on
  // the server. A pending dehydrated promise makes React stream the boundary's content
  // in after the shell, and streamed-in content gets `useId` tree ids that do not match
  // the ones hydration computes - which broke every Radix id inside the table. See the
  // long note in src/app/admin/past-orders/page.tsx.
  await api.order.getAllCurrentOrders.prefetch();

  return (
    <HydrateClient>
      <div className="container mx-auto py-10">
        <Suspense fallback={<Loading />}>
          <DataTable />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
