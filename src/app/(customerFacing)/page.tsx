import { api, HydrateClient } from "~/trpc/server";

import { Metadata } from "next";
import HomePage from "../_components/homePageContent";

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

export default function Home() {
  // Run the query on the server, in parallel with rendering, and ship the
  // result inside the HTML. Without this the browser had to download and
  // hydrate the bundle before it even began asking for the desserts.
  void api.dessert.getMostPopularProducts.prefetch();

  return (
    <HydrateClient>
      <HomePage />
    </HydrateClient>
  );
}
