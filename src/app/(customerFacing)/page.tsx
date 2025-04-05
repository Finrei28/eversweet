import { HydrateClient } from "~/trpc/server";
import HomePageContent from "../_components/homePageContent";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eversweet - Home",
  description:
    "Eversweet offers chinese desserts and drinks, including boba, mochi desserts, Sago desserts and more.",
};

export default function Home() {
  return (
    <HydrateClient>
      <HomePageContent />
    </HydrateClient>
  );
}
