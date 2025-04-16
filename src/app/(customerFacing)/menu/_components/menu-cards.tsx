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
import { useState, useEffect } from "react";
import { Loader2, Soup } from "lucide-react";
import CustomisationDialog from "./customisation";
import { useLanguage } from "~/app/components/language";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "~/lib/formatters";
import { dessertOnClient } from "~/app/components/types";

export default function MenuCards() {
  const { data: productCategory, isLoading: isProductLoading } =
    api.dessert.getProductsForMenuByCategory.useQuery();

  const { data: customisations, isLoading: isCustomisationLoading } =
    api.productCustomisation.availableDessertCustomisations.useQuery();

  const { language } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDessert, setSelectedDessert] =
    useState<dessertOnClient | null>(null);

  // Set the first category as active when data loads
  useEffect(() => {
    if (productCategory && productCategory.length > 0) {
      setActiveCategory(productCategory[0]?.id ?? null);
    }
  }, [productCategory]);

  // Scroll to category section when clicking on category nav
  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      const yOffset = -100; // Adjust this value for proper scroll position
      const y =
        element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const handleOpenDialog = (dessert: dessertOnClient) => {
    setIsDialogOpen(true);
    setSelectedDessert(dessert);
  };

  if (isProductLoading || isCustomisationLoading) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium text-primary">
            {language === "en"
              ? "Loading our delicious menu..."
              : "正在加载我们美味的菜单..."}
          </p>
        </div>
      </div>
    );
  }

  if (!productCategory || productCategory.length === 0) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 rounded-lg bg-muted/30 p-8 text-center">
        <Soup className="h-16 w-16 text-muted" />
        <p className="text-xl font-medium">
          {language === "en"
            ? "Sorry, we currently have no desserts available"
            : "抱歉，我们目前没有甜点出售"}
        </p>
        <p className="text-muted-foreground">
          {language === "en"
            ? "Please check back soon for our delicious offerings"
            : "请稍后再来查看我们美味的产品"}
        </p>
      </div>
    );
  }

  // Filter out categories with no desserts
  const categoriesWithDesserts = productCategory.filter(
    (category) => category.desserts.length > 0,
  );

  return (
    <div className="relative">
      {/* Hero section */}
      <div className="relative mb-12 overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-secondary/20 py-12 text-center">
        {/* <div className="absolute inset-0 z-0 opacity-10">
          <div className="absolute inset-0 bg-[url('/pattern-bg.png')] bg-repeat opacity-20"></div>
        </div> */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="h-6 w-6 text-primary md:h-8 md:w-8" />
            <h1 className="font-serif text-4xl font-bold text-primary md:text-5xl lg:text-6xl">
              {language === "en" ? "Our Menu" : "我们的菜单"}
            </h1>
            <Sparkles className="h-6 w-6 text-primary md:h-8 md:w-8" />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {language === "en"
              ? "Discover our selection of authentic Chinese desserts, handmade with traditional ingredients"
              : "探索我们精选的正宗中式甜点，使用传统食材手工制作"}
          </p>
        </motion.div>
      </div>

      {/* Category navigation */}
      {categoriesWithDesserts.length > 1 && (
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {categoriesWithDesserts.map((category) => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "outline"}
                className="whitespace-nowrap transition-all"
                onClick={() => scrollToCategory(category.id)}
              >
                {language === "en" ? category.name : category.chineseName}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Menu categories and items */}
      <div className="mb-20 space-y-16">
        {categoriesWithDesserts.map((category) => (
          <motion.div
            key={category.id}
            id={`category-${category.id}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 flex items-center">
              <div className="h-px flex-grow bg-primary/20"></div>
              <h2 className="mx-4 text-2xl font-bold text-primary underline md:text-3xl">
                {language === "en" ? category.name : category.chineseName}
              </h2>
              <div className="h-px flex-grow bg-primary/20"></div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 md:px-2 lg:grid-cols-4">
              {category.desserts.map((dessert) => (
                <motion.div
                  key={dessert.id}
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Card className="flex h-full flex-col overflow-hidden border-2 border-transparent transition-all hover:border-secondary hover:shadow-lg">
                    <div className="group relative aspect-square w-full overflow-hidden">
                      <Image
                        src={
                          dessert.imagePath ??
                          (process.env.NEXT_PUBLIC_FILLER_IMAGE_URL as string)
                        }
                        alt={
                          language === "en" ? dessert.name : dessert.chineseName
                        }
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 transition-opacity group-hover:opacity-100">
                        <p
                          className="text-sm font-medium hover:cursor-pointer"
                          onClick={() => handleOpenDialog(dessert)}
                        >
                          {language === "en" ? "Customise" : "定制"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col">
                      <CardHeader className="space-y-2 pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base md:text-xl">
                            {language === "en"
                              ? dessert.name
                              : dessert.chineseName}
                          </CardTitle>
                          {/* {dessert.isHot && (
                            <Badge
                              variant="outline"
                              className="bg-red-100 text-red-600"
                            >
                              {language === "en" ? "Hot" : "热"}
                            </Badge>
                          )}
                          {dessert.isCold && (
                            <Badge
                              variant="outline"
                              className="bg-blue-100 text-blue-600"
                            >
                              {language === "en" ? "Cold" : "冷"}
                            </Badge>
                          )} */}
                        </div>
                        <CardDescription className="line-clamp-2 text-[0.70rem] md:text-xs">
                          {language === "en"
                            ? dessert.ingredients.join(" • ")
                            : dessert.ingredients
                                .map((ingredient) => {
                                  const match = customisations?.find(
                                    (c) => c.name === ingredient,
                                  );
                                  return match?.chineseName || ingredient;
                                })
                                .join(" • ")}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="mt-auto pt-4">
                        <Button
                          className="w-full"
                          onClick={() => handleOpenDialog(dessert)}
                        >{`${language === "en" ? "Add " : "添加 "} ${formatCurrency(dessert.priceInCents / 100)}`}</Button>
                      </CardFooter>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
      {isDialogOpen && selectedDessert && (
        <CustomisationDialog
          customOpen={isDialogOpen}
          setCustomOpen={setIsDialogOpen}
          dessert={selectedDessert}
          onClose={() => setSelectedDessert(null)}
        />
      )}
    </div>
  );
}
