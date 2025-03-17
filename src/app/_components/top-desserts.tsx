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
import CustomisationDialog from "../(customerFacing)/menu/_components/customisation";
import { formatCurrency } from "~/lib/formatters";

export function TopDesserts() {
  const [topDesserts] = api.dessert.getMostPopularProducts.useSuspenseQuery();
  const [isPaused, setIsPaused] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [selectedDessert, setSelectedDessert] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  const handleCardClick = (dessert: any) => {
    setSelectedDessert(dessert);
    setIsDialogOpen(true);
    setIsPaused(true); // Pause carousel when dialog opens
  };

  return (
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
            {topDesserts.map((dessert) => (
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
                          src={dessert.imagePath || "/placeholder.svg"}
                          alt={dessert.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      </div>
                      <div className="bg-white p-4 text-center">
                        <h3 className="truncate text-lg font-semibold text-primary">
                          {dessert.name}{" "}
                          {formatCurrency(dessert.priceInCents / 100)}
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
            <CarouselPrevious className="relative left-0 top-0 hidden bg-gray-100/80 hover:bg-gray-200/90 md:flex md:h-full md:w-14 md:translate-y-0 md:rounded-none" />
          </div>
          <div
            className="absolute right-0 top-0 h-full"
            onMouseDown={handleButtonClick}
          >
            <CarouselNext className="relative right-0 top-0 hidden bg-gray-100/80 hover:bg-gray-200/90 md:flex md:h-full md:w-14 md:translate-y-0 md:rounded-none" />
          </div>
        </Carousel>
      </div>
      {isDialogOpen && selectedDessert && (
        <CustomisationDialog
          homePageOpen={isDialogOpen}
          setHomePageOpen={setIsDialogOpen}
          dessert={selectedDessert}
          onClose={() => setIsPaused(false)}
        />
      )}
    </div>
  );
}
