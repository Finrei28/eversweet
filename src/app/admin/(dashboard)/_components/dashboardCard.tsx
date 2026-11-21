"use client";
import React from "react";
import { useLanguage } from "~/app/components/language";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency, formatNumber } from "~/lib/formatters";
import { api } from "~/trpc/react";

type DashboardCardProps = {
  title: string;
  figure: string;
  /** What the figure counts, in a few words. */
  note: string;
};

/**
 * The dashboard's four figures, each with a line saying what it counts. They come from
 * ~/server/dashboard: today is the Auckland day, and sales are what customers paid, after
 * discounts.
 */
export default function DashBoardCards() {
  const [figures] = api.order.getDashboardFigures.useSuspenseQuery();
  const { language } = useLanguage();
  const en = language === "en";

  const ordersAfterDiscounts = (orders: number) =>
    en
      ? `${formatNumber(orders)} ${orders === 1 ? "order" : "orders"}, after discounts`
      : `${formatNumber(orders)} 个单，已扣除折扣`;

  return (
    // The navbar's own container, so the cards line up under it and keep its gutter.
    // `container` has no padding here, which put them against both edges at 1280px.
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title={en ? "Current orders" : "当前订单"}
          figure={formatNumber(figures.currentOrders)}
          note={
            en
              ? "Due today or overdue, not yet collected"
              : "今天到期或已逾期，尚未取走"
          }
        />
        <DashboardCard
          title={en ? "Collected today" : "今日已取单"}
          figure={formatNumber(figures.collectedToday)}
          note={en ? "Picked up since midnight" : "今天零点以来已取走"}
        />
        <DashboardCard
          title={en ? "Sales today" : "今日销售"}
          figure={formatCurrency(figures.salesToday.paidInCents / 100)}
          note={ordersAfterDiscounts(figures.salesToday.orders)}
        />
        <DashboardCard
          title={en ? "Total sales" : "总销售额"}
          figure={formatCurrency(figures.totalSales.paidInCents / 100)}
          note={ordersAfterDiscounts(figures.totalSales.orders)}
        />
      </div>
    </div>
  );
}

function DashboardCard({ title, figure, note }: DashboardCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{figure}</p>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
