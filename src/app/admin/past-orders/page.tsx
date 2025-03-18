import { DataTable } from "./data-table";
import { auth } from "~/server/auth";
import { notFound } from "next/navigation";
import { api, HydrateClient } from "~/trpc/server";

export default async function PastOrdersPage() {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }
  void api.order.getAllPastOrders.prefetch();

  return (
    <HydrateClient>
      <div className="container mx-auto py-10">
        <DataTable />
      </div>
    </HydrateClient>
  );
}
