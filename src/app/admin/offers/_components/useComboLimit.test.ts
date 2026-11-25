// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement as h, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useForm, type UseFormReturn } from "react-hook-form";
import { type z } from "zod";

import { type offerFormSchema } from "~/app/components/schemas";
import { describeComboCeiling } from "~/lib/offerPricing";
import { useComboLimit } from "./useComboLimit";

/**
 * The offer dialog's live combo limit, rendered for real with the React in node_modules, as
 * the parts field's test is. It has to follow the parts as the admin picks them: in a
 * browser it never did, so the hint under Combo price never showed and the dialog's own
 * check before saving never ran - only the server's refusal did.
 */
type OfferForm = z.infer<typeof offerFormSchema>;

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const desserts = [
  { id: "taro", name: "Taro Mochi Bowl", chineseName: "芋泥麻薯", priceInCents: 1050, category: { id: "mochi" } },
  { id: "matcha", name: "Matcha Mochi Bowl", chineseName: "抹茶麻薯", priceInCents: 950, category: { id: "mochi" } },
  { id: "mango", name: "Mango Sago", chineseName: "芒果西米露", priceInCents: 800, category: { id: "sago" } },
  { id: "lychee", name: "Lychee Sago", chineseName: "荔枝西米露", priceInCents: 900, category: { id: "sago" } },
];
const categories = [
  { id: "mochi", name: "Mochi Series", chineseName: "麻薯系列" },
  { id: "sago", name: "Sago Series", chineseName: "西米系列" },
];

let form: UseFormReturn<OfferForm>;
let limit: ReturnType<typeof useComboLimit>;

function Harness(): ReactNode {
  form = useForm<OfferForm>({
    defaultValues: {
      comboSlots: [
        { dessertId: null, categoryId: null },
        { dessertId: null, categoryId: null },
      ],
    },
  });
  limit = useComboLimit(form, "combo", desserts, categories);
  return null;
}

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(Harness));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** As `ComboSlotsField` sets a row: through the row's own fields, not the array. */
const pick = async (index: number, categoryId: string) => {
  await act(async () => {
    form.setValue(`comboSlots.${index}.dessertId`, null, { shouldDirty: true });
    form.setValue(`comboSlots.${index}.categoryId`, categoryId, { shouldDirty: true });
  });
};

describe("useComboLimit", () => {
  it("has no limit while a part names nothing", () => {
    expect(limit?.en).toBeNull();
  });

  it("follows the parts as they are picked, in both languages", async () => {
    await pick(0, "mochi");
    expect(limit?.en).toBeNull();

    await pick(1, "sago");
    expect(limit?.en?.totalCents).toBe(1750);
    expect(describeComboCeiling(limit!.en!)).toBe(
      "Mochi Series from $9.50 + Sago Series from $8.00 = $17.50",
    );
    expect(describeComboCeiling(limit!.zh!, "zh")).toBe(
      "麻薯系列 $9.50 起 + 西米系列 $8.00 起 = $17.50",
    );

    await pick(1, "mochi");
    expect(limit?.en?.totalCents).toBe(1900);
  });

  it("follows what a part leaves out", async () => {
    await pick(0, "mochi");
    await pick(1, "sago");
    expect(limit?.en?.totalCents).toBe(1750);

    await act(async () => {
      form.setValue("comboSlots.1.excludedDessertIds", ["mango"], { shouldDirty: true });
    });

    expect(limit?.en?.totalCents).toBe(1850);
  });
});
