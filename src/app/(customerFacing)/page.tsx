import { HydrateClient } from "~/trpc/server";

import { Metadata } from "next";
import HomePage from "../_components/homePageContent";

export const metadata: Metadata = {
  title: "Eversweet - Home",
  description:
    "Eversweet offers chinese desserts and drinks, including boba, mochi desserts, Sago desserts and more.",
};

export default function Home() {
  return (
    <HydrateClient>
      <HomePage />
    </HydrateClient>
  );
}
