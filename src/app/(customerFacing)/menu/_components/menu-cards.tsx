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
import { Soup } from "lucide-react";
import { Snowflake } from "lucide-react";
import CustomisationDialog from "./customisation";

export default function MenuCards() {
  const [menuItems] = api.dessert.getProductsForMenu.useSuspenseQuery();
  // const [filteredItems, setFilteredItems] = useState<typeof menuItems | null>(
  //   null,
  // );
  const [filter, setFilter] = useState("All");

  return (
    <>
      <div className="flex gap-5 pb-5">
        <Button
          className={`${filter === "All" && "bg-secondary"}`}
          onClick={() => setFilter("All")}
        >
          ALL
        </Button>
        <Button
          className={`${filter === "Cold" && "bg-secondary"}`}
          onClick={() => setFilter("Cold")}
        >
          COLD
          <Snowflake />
        </Button>
        <Button
          className={`${filter === "Warm" && "bg-secondary"}`}
          onClick={() => setFilter("Warm")}
        >
          WARM
          <Soup />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {menuItems.map((dessert) => (
          <Card key={dessert.id} className="flex flex-col">
            <div className="relative aspect-square w-full">
              <Image
                src={dessert.imagePath || "/placeholder.svg"}
                alt={dessert.name}
                fill
                className="rounded-t-xl object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            <CardHeader className="flex-grow">
              <CardTitle>
                {dessert.name} {formatCurrency(dessert.priceInCents / 100)}
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
