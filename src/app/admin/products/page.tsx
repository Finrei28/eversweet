import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import ProductDialogContext from "./_components/productDialogContext";
import { ProductCards } from "./_components/productCards";
import { EditCustomisation } from "./_components/editCustomisation";
import { auth } from "~/server/auth";
import { notFound } from "next/navigation";
import { api, HydrateClient } from "~/trpc/server";

export default async function ProductsPage() {
  void api.dessert.getProducts.prefetch();
  const session = await auth();

  if (!session?.user) {
    return notFound();
  }
  return (
    <HydrateClient>
      <MaxWidthWapper>
        {/* Search functionality */}
        <div className="mb-10 flex justify-end gap-6">
          <EditCustomisation />
          <ProductDialogContext />
        </div>

        <div className="mb-4 flex justify-center">
          <ProductCards />
        </div>
      </MaxWidthWapper>
    </HydrateClient>
  );
}
