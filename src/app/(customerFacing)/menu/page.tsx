import MenuCards from "~/app/(customerFacing)/menu/_components/menu-cards";
import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import { api, HydrateClient } from "~/trpc/server";
import { ShoppingCart } from "lucide-react";

export default function MenuPage() {
  void api.dessert.getProductsForMenu.prefetch();
  void api.productCustomisation.availableDessertCustomisations.prefetch();
  return (
    <HydrateClient>
      <MaxWidthWapper>
        <div className="py-10">
          <MenuCards />
        </div>
      </MaxWidthWapper>
    </HydrateClient>
  );
}
