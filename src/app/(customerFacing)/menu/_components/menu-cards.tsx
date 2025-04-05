"use client";

import { api } from "~/trpc/react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import Image from "next/image";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Loader2, Soup } from "lucide-react";
import { Snowflake } from "lucide-react";
import CustomisationDialog from "./customisation";
import { useLanguage } from "~/app/components/language";
import { Sparkles } from "lucide-react";

export default function MenuCards() {
  const { data: productCategory, isLoading } =
    api.dessert.getProductsForMenuByCategory.useQuery();
  const [customisations] =
    api.productCustomisation.availableDessertCustomisations.useSuspenseQuery();
  const { language } = useLanguage();
  // const [filter, setFilter] = useState("All");  add filter if required by owner

  if (isLoading) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!productCategory || productCategory.length === 0) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
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
      {/* <div className="flex gap-5 pb-5">
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
      </div> */}
      <div className="flex items-center justify-center gap-1 pb-5 text-primary">
        <Sparkles />
        <h1 className="pt-5 text-5xl font-bold lg:pt-0">
          {language === "en" ? "Menu" : "菜单"}
        </h1>
        <Sparkles />
      </div>
      <div>
        {productCategory?.map(
          (category) =>
            category.desserts.length > 0 && (
              <div key={category.id}>
                <h2 className="pb-4 pt-10 text-3xl font-semibold text-primary underline lg:text-4xl">
                  {language === "en" ? category.name : category.chineseName}
                </h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-8">
                  {category.desserts.map((dessert) => (
                    <Card key={dessert.id} className="flex flex-col">
                      <div className="relative aspect-square w-full">
                        <Image
                          src={dessert.imagePath}
                          alt={
                            language === "en"
                              ? dessert.name
                              : dessert.chineseName
                          }
                          fill
                          className="rounded-t-xl object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      </div>
                      <CardHeader className="flex-grow">
                        <CardTitle>
                          {language === "en"
                            ? dessert.name
                            : dessert.chineseName}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 text-xs">
                          {language === "en"
                            ? dessert.ingredients.join(" + ")
                            : dessert.ingredients
                                .map((ingredient) => {
                                  const match = customisations.find(
                                    (c) => c.name === ingredient,
                                  );
                                  return match?.chineseName || ingredient;
                                })
                                .join(" + ")}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="mt-auto">
                        <CustomisationDialog dessert={dessert} />
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            ),
        )}
      </div>
    </>
  );
}
