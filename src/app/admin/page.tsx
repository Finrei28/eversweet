import { notFound } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { api, HydrateClient } from "~/trpc/server";
import DashBoardCards from "./_components/dashboardCard";

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
      <DashBoardCards />
    </HydrateClient>
  );
}
