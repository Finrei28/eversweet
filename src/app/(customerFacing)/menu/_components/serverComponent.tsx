import { api } from "~/trpc/server";

export default function ServerComponent() {
  void api.productCustomisation.availableDessertCustomisations.prefetch();
  void api.productCustomisation.availableDessertCustomisations.prefetch();
  void api.dessert.getProductsForMenuByCategory.prefetch();

  return null;
}
