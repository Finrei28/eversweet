import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import { ProductCards } from "./_components/productCards";
import { auth } from "~/server/auth";
import { notFound } from "next/navigation";
import { api, HydrateClient } from "~/trpc/server";
import { Suspense } from "react";
import Loader from "~/app/components/customLoading";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  void api.dessert.getProducts.prefetch();
  void api.dessert.getCategories.prefetch();
  void api.productCustomisation.dessertCustomisations.prefetch();
  void api.dessert.getProductsForMenuByCategory.prefetch();
  return (
    <HydrateClient>
      <MaxWidthWapper>
        <Suspense fallback={<Loader text="Loading products..." />}>
          <ProductCards />
        </Suspense>
      </MaxWidthWapper>
    </HydrateClient>
  );
}
