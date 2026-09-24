import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import { ProductCards } from "./_components/productCards";
import { auth } from "~/server/auth";
import { notFound } from "next/navigation";
import { api, HydrateClient } from "~/trpc/server";
import { Suspense } from "react";
import Loading from "./loading";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  /**
   * Awaited rather than `void`-ed, and in parallel.
   *
   * A pending dehydrated promise makes the Suspense boundary suspend on the server, so
   * its content streams in after the shell - and streamed-in content gets `useId` tree
   * ids that do not match the ones hydration computes, which broke every Radix id
   * inside. See the long note in src/app/admin/past-orders/page.tsx.
   *
   * Promise.all rather than separate awaits: these are independent queries and each is
   * a round trip to a remote database, so awaiting them in sequence would stack the
   * latency into the shell.
   */
  await Promise.all([
    api.dessert.getProducts.prefetch(),
    api.dessert.getCategories.prefetch(),
    api.productCustomisation.dessertCustomisations.prefetch(),
    api.dessert.getProductsForMenuByCategory.prefetch(),
    api.dessert.getIngredients.prefetch(),
  ]);

  return (
    <HydrateClient>
      <MaxWidthWapper>
        <Suspense fallback={<Loading />}>
          <ProductCards />
        </Suspense>
      </MaxWidthWapper>
    </HydrateClient>
  );
}
