"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import Loader from "../components/customLoading";
import { DessertAnimation } from "./_homeComponents/_top-desserts-components.tsx/dessert-animation";
import GetTheApp from "./_homeComponents/get-the-app";
import { Hero } from "./_homeComponents/hero";
import MenuPhotos from "./_homeComponents/menu-photos";
import OpeningHours from "./_homeComponents/opening-hours";
import {
  TopDesserts,
  TopDessertsSkeleton,
} from "./_homeComponents/top-desserts";
import UberEats from "./_homeComponents/uber-eats";
import { scrollBehavior } from "~/lib/scrollBehavior";

/**
 * `useSearchParams()` makes the closest Suspense boundary bail out of the
 * static render. It used to sit in HomePageContent, so the entire page fell
 * back and the served HTML contained nothing but the navbar. Isolated here, it
 * is the only thing that bails and the rest of the page prerenders.
 */
function ScrollToOpeningHours({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLDivElement>;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("scrollTo") === "opening-hours") {
      setTimeout(() => {
        targetRef.current?.scrollIntoView({ behavior: scrollBehavior() });
      }, 300); // slight delay to ensure DOM is ready
    }
  }, [searchParams, targetRef]);

  return null;
}

function HomePageContent({ address }: { address?: string }) {
  const openingHoursRef = useRef<HTMLDivElement>(null);
  const menuPhotoRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  return (
    <>
      <Suspense fallback={null}>
        <ScrollToOpeningHours targetRef={openingHoursRef} />
      </Suspense>

      {/* The falling desserts cover the hero down to Uber Eats, and settle on the menu
          boards. Rendered last so they draw over what they fall past. */}
      <div className="relative">
        <Hero
          address={address}
          onOpeningHours={() =>
            openingHoursRef.current?.scrollIntoView({
              behavior: scrollBehavior(),
            })
          }
        />
        <Suspense fallback={<TopDessertsSkeleton />}>
          <TopDesserts />
        </Suspense>
        <MenuPhotos imageRefs={menuPhotoRefs} />
        <UberEats />
        <DessertAnimation
          landingRefs={menuPhotoRefs}
          density={34}
          speed={0.6}
        />
      </div>

      <section className="px-5 py-8 lg:py-20">
        <GetTheApp />
      </section>

      <section
        ref={openingHoursRef}
        id="opening-hours"
        className="scroll-mt-2 border-t border-border"
      >
        <OpeningHours />
      </section>

      {/* The footer moved to `(customerFacing)/layout.tsx`, so that it - and the only
          links to the legal documents - appear on every page rather than only here. */}
    </>
  );
}

export default function HomePage({ address }: { address?: string }) {
  return (
    <Suspense fallback={<Loader />}>
      <HomePageContent address={address} />
    </Suspense>
  );
}
