import { api, HydrateClient } from "~/trpc/server";

import { Metadata } from "next";
import HomePage from "../_components/homePageContent";
import { getShopProfile } from "~/server/shopProfile";

export const metadata: Metadata = {
  title: "Eversweet - Home",
  description:
    "Eversweet offers chinese desserts and drinks, including Boba, Mochi desserts, Sago desserts, Coconut Jelly and more.",
  alternates: { canonical: "/" },
};

/**
 * Rendered per request rather than prerendered at build time.
 *
 * The server-side prefetch below goes through the tRPC context, which reads
 * headers and the session, so this page cannot be statically prerendered. The
 * data itself is cached in the Next.js data cache (see MENU_CACHE_TAG in
 * ~/server/api/routers/product), so a request here normally costs no database
 * round trip - it renders from cache with the payload already in the HTML.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  // What the app band may claim (points, the member rate, the leaderboard), from a cache
  // like the desserts. Below the fold, so it may stream in after the shell; started first
  // so it runs alongside the reads awaited below.
  void api.store.getAppPromotion.prefetch();
  // Run the query on the server and ship the result inside the HTML. Without this the
  // browser had to download and hydrate the bundle before it even began asking for the
  // desserts.
  //
  // Awaited, not `void`-ed: the hero's bowls are drawn from it, and render in the shell
  // with no Suspense boundary (see HeroBowls), because the first bowl is the page's largest
  // paint on a phone. In a boundary they streamed in after the shell, revealed only after
  // the first paint, and the bowl painted some 400ms after its image had arrived. Read from
  // the data cache (MENU_CACHE_TAG), the query normally costs the shell no database round
  // trip.
  //
  // The address for the hero's "Open today until..." line comes alongside: the same
  // cached read the root layout's structured data makes on every page.
  const [, { address }] = await Promise.all([
    api.dessert.getMostPopularProducts.prefetch(),
    getShopProfile(),
  ]);

  return (
    <HydrateClient>
      <HomePage address={address} />
    </HydrateClient>
  );
}
