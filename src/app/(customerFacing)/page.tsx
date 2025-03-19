import { HydrateClient } from "~/trpc/server";
import HomePageContent from "../_components/homePageContent";

export default function Home() {
  return (
    <HydrateClient>
      <HomePageContent />
    </HydrateClient>
  );
}
