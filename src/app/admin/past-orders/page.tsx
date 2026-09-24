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
  /**
   * Awaited, not `void`-ed.
   *
   * `void prefetch()` leaves a *pending* promise in the dehydrated cache, so the
   * Suspense boundary below suspends on the server and its content is streamed in after
   * the shell. React assigns `useId` tree ids to streamed-in boundary content that do
   * not match the ones it computes while hydrating, so every Radix `useId` inside the
   * table - the row-action DropdownMenu triggers - mismatched, and React responded by
   * throwing the subtree away and re-rendering it on the client.
   *
   * Awaiting resolves the promise before this page renders, so the boundary below never
   * suspends and the table hydrates. The page as a whole still streams in behind
   * `loading.tsx`, which is what shows while a navigation waits on this await - that
   * is safe because what streams carries a resolved query, not a pending one.
   */
  await api.order.getAllPastOrders.prefetch();

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
