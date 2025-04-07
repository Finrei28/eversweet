import { api } from "~/trpc/server";

export default function ServerComponent() {
  void api.productCustomisation.availableDessertCustomisations.prefetch();

  return null;
}
