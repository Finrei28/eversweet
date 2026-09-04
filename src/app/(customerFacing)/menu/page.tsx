import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import { api, HydrateClient } from "~/trpc/server";
import MenuCards from "./_components/menu-cards";
import { Metadata } from "next";
import { Suspense } from "react";
import Loader from "~/app/components/customLoading";

export const metadata: Metadata = {
  title: "Eversweet - Menu",
  description: "Take a look at our various collection of desserts and drinks",
  alternates: { canonical: "/menu" },
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

export default function MenuPage() {
  // Replaces the old <ServerComponent />, which imported the server-side `api`
  // and then returned null without ever calling it.
  void api.dessert.getProductsForMenuByCategory.prefetch();

  return (
    <HydrateClient>
      <MaxWidthWapper>
        <Suspense fallback={<Loader />}>
          <MenuCards />
        </Suspense>
      </MaxWidthWapper>
    </HydrateClient>
  );
}
