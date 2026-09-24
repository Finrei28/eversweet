"use client";
import React from "react";
import { useLanguage } from "~/app/components/language";
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
  const { language } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="grid w-full grid-cols-1 gap-6 lg:w-3/12">
        <DashboardCard
          title={language === "en" ? "Current Orders:" : "当前订单:"}
          content={`${formatNumber(Currentorders)} ${language === "en" ? "Orders" : "个单"}`}
        />
        <DashboardCard
          title={language === "en" ? "Orders Completed:" : "订单已完成:"}
          content={`${formatNumber(CompletedOrders)} ${language === "en" ? "Orders" : "个单"}`}
        />
        <DashboardCard
          title={language === "en" ? "Sales Today:" : "今日销售:"}
          description={formatNumber(sales.numberOfSales)}
          content={formatCurrency(sales.amount)}
        />
        <DashboardCard
          title={language === "en" ? "Total Sales:" : "总销售额:"}
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
