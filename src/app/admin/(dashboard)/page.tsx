import { notFound } from "next/navigation";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import DashBoardCards from "./_components/dashboardCard";
import { Suspense } from "react";
import Loading from "./loading";

// localhost:3000/api/auth/signin for sign in page
export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  /**
   * Awaited rather than `void`-ed.
   *
   * A pending dehydrated promise makes the Suspense boundary suspend on the server, so
   * its content streams in after the shell - and streamed-in content gets `useId` tree
   * ids that do not match the ones hydration computes, which broke every Radix id
   * inside. See the long note in src/app/admin/past-orders/page.tsx.
   *
   * One query for all four cards; its four database reads run in parallel on the server.
   */
  await api.order.getDashboardFigures.prefetch();

  return (
    <HydrateClient>
      <Suspense fallback={<Loading />}>
        <DashBoardCards />
      </Suspense>
    </HydrateClient>
  );
}
