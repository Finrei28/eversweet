import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import { HydrateClient } from "~/trpc/server";
import MenuCards from "./_components/menu-cards";
import ServerComponent from "./_components/serverComponent";
import { Metadata } from "next";
import { Suspense } from "react";
import Loader from "~/app/components/customLoading";

export const metadata: Metadata = {
  title: "Eversweet - Menu",
  description: "Take a look at our various collection of desserts and drinks",
};

export default function MenuPage() {
  return (
    <HydrateClient>
      <ServerComponent />
      <MaxWidthWapper>
        <Suspense fallback={<Loader />}>
          <MenuCards />
        </Suspense>
      </MaxWidthWapper>
    </HydrateClient>
  );
}
