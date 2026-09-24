import { DataTable } from "./data-table";
import { auth } from "~/server/auth";
import { notFound } from "next/navigation";
import { api, HydrateClient } from "~/trpc/server";
import { Suspense } from "react";
import Loader from "~/app/components/customLoading";

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
   * Awaiting resolves the promise before the shell renders, so the boundary never
   * suspends and the table hydrates. The trade is this page no longer streams; the
   * Suspense fallback stays as a safety net for client-side navigation.
   */
  await api.order.getAllPastOrders.prefetch();

  return (
    <HydrateClient>
      <div className="container mx-auto py-10">
        <Suspense
          fallback={
            <Loader
              text={{
                en: "Loading past orders...",
                zh: "正在加载过去的订单...",
              }}
            />
          }
        >
          <DataTable />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
