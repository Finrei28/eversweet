import { notFound } from "next/navigation";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import DashBoardCards from "./_components/dashboardCard";
import { Suspense } from "react";
import Loader from "../components/customLoading";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  void api.order.getCurrentOrders.prefetch();
  void api.order.getCompletedOrders.prefetch();
  void api.order.getSalesToday.prefetch();
  void api.order.getTotalSales.prefetch();

  return (
    <HydrateClient>
      <Suspense fallback={<Loader />}>
        <DashBoardCards />
      </Suspense>
    </HydrateClient>
  );
}
