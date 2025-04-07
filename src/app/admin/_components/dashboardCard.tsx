"use client";
import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatCurrency, formatNumber } from "~/lib/formatters";
import { api } from "~/trpc/react";

type DashboardCardProps = {
  title: string;
  description?: string;
  content: string;
};

export default function DashBoardCards() {
  const [Currentorders] = api.order.getCurrentOrders.useSuspenseQuery();
  const [CompletedOrders] = api.order.getCompletedOrders.useSuspenseQuery();
  const [sales] = api.order.getSalesToday.useSuspenseQuery();
  const [totlaSales] = api.order.getTotalSales.useSuspenseQuery();
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
          description={formatNumber(sales.numberOfSales)}
          content={formatCurrency(sales.amount)}
        />
        <DashboardCard
          title="Total Sales:"
          description={formatNumber(totlaSales.totalNumberOfSales)}
          content={formatCurrency(totlaSales.totalAmount)}
        />
      </div>
    </div>
  );
}

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
