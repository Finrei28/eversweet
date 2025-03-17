import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatCurrency, formatNumber } from "~/lib/formatters";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

async function getCurrentOrders() {
  const Currentorders = await db.order.count({
    where: {
      completed: false,
    },
  });
  return Currentorders;
}

async function getCompletedOrders() {
  const CompletedOrders = await db.order.count({
    where: {
      completed: true,
    },
  });
  return CompletedOrders;
}

async function getSalesToday() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0); // Set to 00:00:00 of today

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999); // Set to 23:59:59 of today

  const salesToday = await db.order.aggregate({
    _sum: { priceInCents: true },
    _count: true,
    where: {
      createdAt: {
        gte: startOfToday, // Orders from today 00:00:00 onwards
        lt: endOfToday, // Orders before tomorrow 00:00:00
      },
    },
  });

  return {
    amount: (salesToday._sum.priceInCents || 0) / 100,
    numberOfSales: salesToday._count,
  };
}

async function getTotalSales() {
  const totalSales = await db.order.aggregate({
    _sum: { priceInCents: true },
    _count: true,
  });

  return {
    totalAmount: (totalSales._sum.priceInCents || 0) / 100,
    totalNumberOfSales: totalSales._count,
  };
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const Currentorders = await getCurrentOrders();
  const CompletedOrders = await getCompletedOrders();
  const { amount, numberOfSales } = await getSalesToday();
  const { totalAmount, totalNumberOfSales } = await getTotalSales();

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="grid w-full grid-cols-1 gap-6 lg:w-3/12">
        <DashboardCard
          title="Current Orders:"
          content={`${formatNumber(Currentorders)} Orders`}
        />
        <DashboardCard
          title="Orders Completed:"
          content={`${formatNumber(CompletedOrders)} Orders`}
        />
        <DashboardCard
          title="Sales Today:"
          description={formatNumber(numberOfSales)}
          content={formatCurrency(amount)}
        />
        <DashboardCard
          title="Total Sales:"
          description={formatNumber(totalNumberOfSales)}
          content={formatCurrency(totalAmount)}
        />
      </div>
    </div>
  );
}

type DashboardCardProps = {
  title: string;
  description?: string;
  content: string;
};

function DashboardCard({ title, description, content }: DashboardCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p>{content}</p>
      </CardContent>
    </Card>
  );
}
