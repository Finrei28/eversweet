"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

import CustomisationDialog from "../../(customerFacing)/menu/_components/customisation";
import {
  DessertPrice,
  dessertButtonLabel,
} from "../../components/dessertPrice";
import { ItemName } from "../../components/itemName";
import { useLanguage } from "../../components/language";
import { Skeleton } from "~/components/ui/skeleton";
import type { dessertOnClient } from "~/lib/types";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

/** How many popular choices the desktop row shows; a phone's strip scrolls through them all. */
export const POPULAR_ROW = 5;

/**
 * Popular choices: a still row of five on desktop and a strip that scrolls sideways on a
 * phone. It was a carousel that moved every three seconds. Each opens the customise
 * dialog, as the carousel's cards did.
 */
function Section({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const en = language === "en";
  return (
    <section className="mx-auto w-full max-w-[1240px] px-5 pb-10 pt-2 lg:pb-20">
      <div className="mb-[18px] flex items-baseline justify-between gap-4 lg:mb-7">
        <h2 className="text-2xl font-extrabold lg:text-[32px]">
          {en ? "Popular choices" : "畅销品"}
        </h2>
        <Link
          href="/menu"
          className="flex shrink-0 items-center gap-1 rounded-md py-2.5 text-[15px] font-bold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:text-base"
        >
          {en ? "See the full menu" : "查看完整菜单"}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      {/* The strip runs to the screen's edges on a phone; the row sits in the column. */}
      <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1 scrollbar-hide lg:mx-0 lg:grid lg:scroll-px-0 lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:px-0">
        {children}
      </div>
    </section>
  );
}

export function TopDessertsSkeleton() {
  return (
    <Section>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex w-[156px] shrink-0 snap-start flex-col gap-3 lg:w-auto"
        >
          <Skeleton className="aspect-square w-full rounded-full bg-muted" />
          <Skeleton className="h-5 w-4/5 bg-muted" />
          <Skeleton className="h-4 w-1/2 bg-muted" />
        </div>
      ))}
    </Section>
  );
}

export function TopDesserts() {
  const [topDesserts] = api.dessert.getMostPopularProducts.useSuspenseQuery();
  const [selectedDessert, setSelectedDessert] =
    useState<dessertOnClient | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { language } = useLanguage();

  const open = (dessert: dessertOnClient) => {
    setSelectedDessert(dessert);
    setIsDialogOpen(true);
  };

  return (
    <>
      <Section>
        {topDesserts.map((dessert, index) => (
          <button
            key={dessert.id}
            type="button"
            aria-label={dessertButtonLabel(dessert, language)}
            onClick={() => open(dessert)}
            className={cn(
              "group flex w-[156px] shrink-0 snap-start flex-col gap-3 rounded-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background lg:w-auto lg:gap-3.5",
              index >= POPULAR_ROW && "lg:hidden",
            )}
          >
            <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-muted">
              <Image
                src={
                  dessert.imagePath ||
                  (process.env.NEXT_PUBLIC_FILLER_IMAGE_URL as string)
                }
                alt=""
                fill
                sizes="(min-width: 1024px) 220px, 156px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </span>
            <ItemName
              name={dessert.name}
              chineseName={dessert.chineseName}
              leadClassName="text-base leading-tight lg:text-lg"
              secondClassName="text-sm lg:text-[15px]"
            />
            <span className="mt-auto flex w-full items-end justify-between gap-2">
              <DessertPrice
                dessert={dessert}
                language={language}
                priceClassName="text-base lg:text-[17px]"
              />
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[filter] group-hover:brightness-95"
              >
                <Plus className="h-5 w-5" strokeWidth={2.4} />
              </span>
            </span>
          </button>
        ))}
      </Section>
      {isDialogOpen && selectedDessert && (
        <CustomisationDialog
          customOpen={isDialogOpen}
          setCustomOpen={setIsDialogOpen}
          dessert={selectedDessert}
        />
      )}
    </>
  );
}
