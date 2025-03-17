import { orders } from "sampleData";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function PastOrdersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  const oldOrders = orders.filter((order) => order.completed === true);
  return (
    <div className="container mx-auto py-10">
      <DataTable columns={columns} data={oldOrders} />
    </div>
  );
}
