"use client";

import { api } from "~/trpc/react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatCurrency } from "~/lib/formatters";
import Image from "next/image";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Loader2, Soup } from "lucide-react";
import { Snowflake } from "lucide-react";
import CustomisationDialog from "./customisation";
import { useLanguage } from "~/app/components/language";

export default function MenuCards() {
  const { data: menuItems, isLoading } =
    api.dessert.getProductsForMenu.useQuery();
  const { language } = useLanguage();
  const [filter, setFilter] = useState("All");

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-20rem)] flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!menuItems || menuItems.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-20rem)] flex-col items-center justify-center">
        <p className="text-lg">
          {language === "en"
            ? "Sorry, we currently have no desserts for sale"
            : "抱歉，我们目前没有甜点出售"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-5 pb-5">
        <Button
          className={`${filter === "All" && "bg-secondary"}`}
          onClick={() => setFilter("All")}
        >
          {language === "en" ? "ALL" : "全部"}
        </Button>
        <Button
          className={`${filter === "Cold" && "bg-secondary"}`}
          onClick={() => setFilter("Cold")}
        >
          {language === "en" ? "COLD" : "冷"}
          <Snowflake />
        </Button>
        <Button
          className={`${filter === "Warm" && "bg-secondary"}`}
          onClick={() => setFilter("Warm")}
        >
          {language === "en" ? "WARM" : "温"}
          <Soup />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {menuItems?.map((dessert) => (
          <Card key={dessert.id} className="flex flex-col">
            <div className="relative aspect-square w-full">
              <Image
                src={dessert.imagePath || "/placeholder.svg"}
                alt={language === "en" ? dessert.name : dessert.chineseName}
                fill
                className="rounded-t-xl object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            <CardHeader className="flex-grow">
              <CardTitle>
                {language === "en" ? dessert.name : dessert.chineseName}{" "}
                {formatCurrency(dessert.priceInCents / 100)}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {dessert.description}
              </CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <CustomisationDialog dessert={dessert} />
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}
