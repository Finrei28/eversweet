"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useLanguage } from "~/app/components/language";
import { Feedback } from "@prisma/client";

export function GetPastOrderColumns(): ColumnDef<Feedback>[] {
  const { language } = useLanguage();

  return [
    {
      accessorKey: "name",
      header: language === "en" ? "name" : "顾客",
      cell: ({ row }) => {
        const name = row.original.name;
        return <div className="font-medium">{name}</div>;
      },
      filterFn: (row, columnId, filterValue: string) => {
        const name = row.original.name?.toLowerCase();

        return name ? name?.includes(filterValue.toLowerCase()) : false;
      },
    },
    {
      accessorKey: "email",
      header: language === "en" ? "Email" : "邮箱",
      cell: ({ row }) => {
        const email = row.original.email;
        return <div className="font-medium">{email}</div>;
      },
    },
    {
      accessorKey: "message",
      header: language === "en" ? "Feedback" : "反馈",
      cell: ({ row }) => {
        const status = row.original.feedbackMessage;
        return <div className="font-medium">{status}</div>;
      },
    },
    {
      accessorKey: "rating",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {language === "en" ? "rating" : "评分"}
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const rating = row.original.rating;
        return <div className="font-medium">{rating}</div>;
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {language === "en" ? "Created" : "创建时间"}
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const createdAt = row.original.createdAt;
        const formatted = new Intl.DateTimeFormat("en-NZ").format(createdAt);
        return <div className="font-medium">{formatted}</div>;
      },
    },
  ];
}
