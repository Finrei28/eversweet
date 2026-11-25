import { formatCurrency } from "~/lib/formatters";

type Named = { name: string; chineseName: string };

type Slot = { position: number; dessert: Named | null; category: Named | null };

/**
 * A combo's parts, in order, as the offers table names them: "Combo: Mochi Series + Sago
 * Series". A combo has no dessert or category of its own, so the "Applies to" column showed
 * a dash for it.
 */
export const comboPartsLabel = (slots: readonly Slot[], language: "en" | "zh") => {
  const parts = [...slots]
    .sort((a, b) => a.position - b.position)
    .map((slot) => {
      const target = slot.dessert ?? slot.category;
      if (!target) return "?";
      return language === "en" ? target.name : target.chineseName;
    })
    .join(" + ");
  return language === "en" ? `Combo: ${parts}` : `套餐：${parts}`;
};

/** One price for the set: "$15.00 combo", or free for nothing, as a fixed price says it. */
export const comboPriceLabel = (cents: number, language: "en" | "zh") => {
  if (cents === 0) return language === "en" ? "Free combo" : "免费套餐";
  const price = formatCurrency(cents / 100);
  return language === "en" ? `${price} combo` : `套餐价 ${price}`;
};
