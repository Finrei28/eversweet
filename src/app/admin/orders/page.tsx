import { orders } from "sampleData";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function PastOrdersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  const newOrders = orders.filter((order) => order.completed === false);
  return (
    <div className="container mx-auto py-10">
      <DataTable columns={columns} data={newOrders} />
    </div>
  );
}
