"use client";

import { api } from "~/trpc/react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Card, CardContent } from "~/components/ui/card";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import CustomisationDialog from "../../(customerFacing)/menu/_components/customisation";
import { formatCurrency } from "~/lib/formatters";
import { Skeleton } from "~/components/ui/skeleton";
import { useLanguage } from "../../components/language";
import {
  DessertAnimation,
  DessertType,
} from "./_top-desserts-components.tsx/dessert-animation";
import { Ingredients } from "~/app/components/types";

type dessert = {
  id: string;
  name: string;
  description: string | null;
  chineseName: string;
  priceInCents: number;
  imagePath: string;
  ingredients: Ingredients;
  imagePublicId: string;
  isAvailableForPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function TopDesserts() {
  const { data: topDesserts, isLoading } =
    api.dessert.getMostPopularProducts.useQuery();
  const [isPaused, setIsPaused] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [selectedDessert, setSelectedDessert] = useState<dessert | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { language } = useLanguage();
  const [dessertAnimation, setDessertAnimation] = useState<DessertType | null>(
    null,
  );

  // Set up autoplay
  useEffect(() => {
    if (!carouselApi || isPaused) return;

    // Start autoplay
    const autoplayInterval = setInterval(() => {
      carouselApi.scrollNext();
    }, 3000); // Move to next slide every 3 seconds

    return () => {
      clearInterval(autoplayInterval);
    };
  }, [carouselApi, isPaused]);

  // Handle button clicks without overriding default behavior
  const handleButtonClick = () => {
    setIsPaused(true);
  };

  const getRandomDessert = (): DessertType => {
    const desserts: DessertType[] = ["sago", "mochi", "boba", "taro", "mango"];
    const randomIndex = Math.floor(Math.random() * desserts.length);
    return desserts[randomIndex] as DessertType;
  };

  useEffect(() => {
    const animationType = getRandomDessert();
    setDessertAnimation(animationType);
  }, []);

  const handleCardClick = (dessert: dessert) => {
    setSelectedDessert(dessert);
    setIsDialogOpen(true);
    setIsPaused(true); // Pause carousel when dialog opens
  };

  if (isLoading) {
    return (
      <>
        <h1 className="text-2xl font-extrabold text-primary sm:text-4xl">
          {language === "en" ? "OUR MOST POPULAR DESSERTS" : "畅销品"}
        </h1>
        <div className="mx-auto w-full max-w-7xl px-4">
          <div className="relative">
            <Carousel
              opts={{
                align: "center",
                loop: true,
                dragFree: false,
                containScroll: "keepSnaps",
              }}
              className="w-full border-l-2 border-r-2 border-dashed border-primary"
              setApi={undefined}
            >
              <CarouselContent className="-ml-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <CarouselItem
                    className="basis-1/2 pl-4 md:basis-1/4 lg:basis-1/4"
                    key={index}
                  >
                    <Card className="min-h-[270px] w-full select-none overflow-hidden border-2 border-secondary lg:min-h-[350px]">
                      <CardContent className="p-0">
                        <Skeleton className="min-h-[200px] w-full bg-secondary lg:min-h-[290px]" />
                        <div className="mt-2 flex flex-col items-center justify-center gap-2 lg:mt-3">
                          <Skeleton className="h-4 w-10/12 rounded-xl bg-secondary lg:h-6" />
                          <Skeleton className="h-4 w-4/12 rounded-xl bg-secondary lg:hidden lg:h-6" />
                        </div>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="absolute left-0 top-0 h-full">
                <CarouselPrevious
                  className="relative left-0 top-0 hidden bg-gray-100/80 hover:bg-gray-200/90 md:flex md:h-full md:w-14 md:translate-y-0 md:rounded-none"
                  disabled
                />
              </div>
              <div className="absolute right-0 top-0 h-full">
                <CarouselNext
                  className="relative right-0 top-0 hidden bg-gray-100/80 hover:bg-gray-200/90 md:flex md:h-full md:w-14 md:translate-y-0 md:rounded-none"
                  disabled
                />
              </div>
            </Carousel>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="flex flex-col items-center justify-center text-2xl font-extrabold text-primary sm:text-4xl">
        {language === "en" ? "OUR MOST POPULAR DESSERTS" : "畅销品"}
      </h1>
      {dessertAnimation && (
        <DessertAnimation type={dessertAnimation} density={10} speed={1.2} />
      )}

      <div className="mx-auto w-full max-w-7xl px-4">
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={!isDialogOpen ? () => setIsPaused(false) : undefined}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={!isDialogOpen ? () => setIsPaused(false) : undefined}
        >
          <Carousel
            opts={{
              align: "center",
              loop: true,
              skipSnaps: false,
              containScroll: "trimSnaps",
            }}
            className="w-full border-l-2 border-r-2 border-dashed border-primary"
            setApi={setCarouselApi}
          >
            <CarouselContent className="-ml-4">
              {topDesserts?.map((dessert) => (
                <CarouselItem
                  key={dessert.id}
                  className="basis-1/2 overflow-visible pl-4 md:basis-1/4 lg:basis-1/4"
                >
                  <div className="overflow-hidden">
                    <Card
                      className="h-full select-none overflow-hidden border-2 border-secondary transition-transform duration-300 md:hover:scale-105 md:hover:cursor-pointer"
                      onClick={() => handleCardClick(dessert)}
                    >
                      <CardContent className="p-0">
                        <div className="relative aspect-square w-full">
                          <Image
                            src={
                              dessert.imagePath ||
                              (process.env
                                .NEXT_PUBLIC_FILLER_IMAGE_URL as string)
                            }
                            alt={
                              language === "en"
                                ? dessert.name
                                : dessert.chineseName
                            }
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        </div>
                        <div className="bg-white p-4 text-center">
                          <h3 className="truncate text-lg font-semibold text-primary">
                            {language === "en"
                              ? dessert.name
                              : dessert.chineseName}{" "}
                            <span className="block sm:inline">
                              {formatCurrency(dessert.priceInCents / 100)}
                            </span>
                          </h3>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div
              className="absolute left-0 top-0 h-full"
              onMouseDown={handleButtonClick}
            >
              <CarouselPrevious className="relative left-0 top-0 hidden bg-gray-100/80 hover:bg-gray-200/90 md:flex md:h-full md:w-16 md:translate-y-0 md:rounded-none" />
            </div>
            <div
              className="absolute right-0 top-0 h-full"
              onMouseDown={handleButtonClick}
            >
              <CarouselNext className="relative right-0 top-0 hidden bg-gray-100/80 hover:bg-gray-200/90 md:flex md:h-full md:w-16 md:translate-y-0 md:rounded-none" />
            </div>
          </Carousel>
        </div>
        {isDialogOpen && selectedDessert && (
          <CustomisationDialog
            customOpen={isDialogOpen}
            setCustomOpen={setIsDialogOpen}
            dessert={selectedDessert}
            onClose={() => setIsPaused(false)}
          />
        )}
      </div>
    </>
  );
}
