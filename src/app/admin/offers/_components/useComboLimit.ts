import { useMemo } from "react";
import { type UseFormReturn } from "react-hook-form";
import { type z } from "zod";

import { type offerFormSchema } from "~/app/components/schemas";
import { comboCeiling } from "~/lib/offerPricing";

type OfferForm = z.infer<typeof offerFormSchema>;

type LimitDessert = {
  id: string;
  name: string;
  chineseName: string;
  priceInCents: number;
  category: { id: string };
};

type LimitCategory = { id: string; name: string; chineseName: string | null };

/**
 * What a combo's set has to come in under: the cheapest dessert each part can take, added
 * up. Mirrors `assertComboUnderCeiling` in the router, which decides; this tells the admin
 * while typing. Worded in both languages, with the names the menu uses. Null for a single
 * offer, and while a part names nothing on the menu.
 */
export function useComboLimit(
  form: UseFormReturn<OfferForm>,
  kind: "single" | "combo",
  desserts: readonly LimitDessert[],
  categories: readonly LimitCategory[],
) {
  const comboSlots = form.watch("comboSlots");

  return useMemo(() => {
    if (kind !== "combo") return null;
    const named = (useChinese: boolean) =>
      comboCeiling(
        comboSlots,
        desserts.map((dessert) => ({
          id: dessert.id,
          name: useChinese ? dessert.chineseName : dessert.name,
          priceInCents: dessert.priceInCents,
          categoryId: dessert.category.id,
        })),
        (id) => {
          const category = categories.find((c) => c.id === id);
          return (useChinese ? category?.chineseName : category?.name) ?? id;
        },
      );
    return { en: named(false), zh: named(true) };
  }, [kind, comboSlots, desserts, categories]);
}
