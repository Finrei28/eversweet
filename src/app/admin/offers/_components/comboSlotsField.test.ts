// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement as h, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { type z } from "zod";

import { LanguageProvider } from "~/app/components/language";
import { type offerFormSchema } from "~/app/components/schemas";
import ComboSlotsField from "./comboSlotsField";

/**
 * A combo's parts in the offer dialog: 2-4 rows, each a dessert or a whole category. Rendered
 * for real, with the React in node_modules, as the requirements field's test is.
 */
type OfferForm = z.infer<typeof offerFormSchema>;

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let form: UseFormReturn<OfferForm>;

const categories = [
  { id: "mochi", name: "Mochi Series", chineseName: "麻糬系列" },
  { id: "sago", name: "Sago Series", chineseName: "西米露系列" },
];

function Harness({ slots }: { slots: OfferForm["comboSlots"] }): ReactNode {
  form = useForm<OfferForm>({ defaultValues: { comboSlots: slots } });
  return h(FormProvider<OfferForm>, {
    ...form,
    children: h(ComboSlotsField, {
      control: form.control,
      desserts: [
        { id: "taro", name: "Taro Mochi Bowl", chineseName: "芋泥麻糬", category: { id: "mochi" } },
        { id: "mango", name: "Mango Sago", chineseName: "芒果西米露", category: { id: "sago" } },
        { id: "durian", name: "Durian Sago", chineseName: "榴莲西米露", category: { id: "sago" } },
      ],
      categories,
    }),
  });
}

let root: Root;
let container: HTMLDivElement;

const render = async (slots: OfferForm["comboSlots"]) => {
  await act(async () => {
    root.render(h(LanguageProvider, null, h(Harness, { slots })));
  });
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = (label: string) => {
  const found = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.includes(label) || b.getAttribute("aria-label") === label,
  );
  if (!found) throw new Error(`no button ${label}`);
  return found;
};
const removeButtons = () =>
  [...container.querySelectorAll("button")].filter((b) =>
    b.getAttribute("aria-label")?.startsWith("Remove part"),
  );

describe("a combo's parts", () => {
  const two = [
    { dessertId: null, categoryId: "mochi" },
    { dessertId: null, categoryId: "sago" },
  ];

  it("lists one row per part, numbered in order", async () => {
    await render(two);
    expect(container.textContent).toContain("Part 1");
    expect(container.textContent).toContain("Part 2");
    expect(container.textContent).toContain("Mochi Series");
    expect(container.textContent).toContain("Sago Series");
  });

  it("keeps two parts at the least: neither can be removed", async () => {
    await render(two);
    expect(removeButtons()).toHaveLength(2);
    expect(removeButtons().every((b) => b.disabled)).toBe(true);
  });

  it("adds a part until there are four, and no more", async () => {
    await render(two);
    await act(async () => button("Add part").click());
    await act(async () => button("Add part").click());
    expect(form.getValues("comboSlots")).toHaveLength(4);
    expect(button("Add part").disabled).toBe(true);
    // Above two, a part can go again.
    expect(removeButtons().every((b) => !b.disabled)).toBe(true);
  });

  /** The "Leave out" boxes under part `index`, by the dessert each names. */
  const leaveOutBoxes = (index: number) => {
    const row = container.querySelectorAll<HTMLElement>("[data-combo-part]")[index];
    return [...(row?.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]') ?? [])];
  };
  const boxNamed = (index: number, name: string) => {
    const box = leaveOutBoxes(index).find((b) =>
      b.closest("label")?.textContent?.includes(name),
    );
    if (!box) throw new Error(`no box for ${name} under part ${index + 1}`);
    return box;
  };

  // "Any sago but the durian", as a category offer can.
  it("lets a category part leave its desserts out, and a dessert part nothing", async () => {
    await render([
      { dessertId: "taro", categoryId: null },
      { dessertId: null, categoryId: "sago", excludedDessertIds: [] },
    ]);

    expect(leaveOutBoxes(0)).toHaveLength(0);
    expect(leaveOutBoxes(1)).toHaveLength(2);

    await act(async () => boxNamed(1, "Durian Sago").click());
    expect(form.getValues("comboSlots.1.excludedDessertIds")).toEqual(["durian"]);

    await act(async () => boxNamed(1, "Durian Sago").click());
    expect(form.getValues("comboSlots.1.excludedDessertIds")).toEqual([]);
  });

  it("shows a part's stored exclusions ticked", async () => {
    await render([
      { dessertId: null, categoryId: "mochi" },
      { dessertId: null, categoryId: "sago", excludedDessertIds: ["mango"] },
    ]);

    expect(boxNamed(1, "Mango Sago").getAttribute("aria-checked")).toBe("true");
    expect(boxNamed(1, "Durian Sago").getAttribute("aria-checked")).toBe("false");
  });

  it("removes the part asked for", async () => {
    await render([...two, { dessertId: "taro", categoryId: null }]);
    await act(async () => removeButtons()[0]!.click());
    expect(form.getValues("comboSlots")).toEqual([
      { dessertId: null, categoryId: "sago" },
      { dessertId: "taro", categoryId: null },
    ]);
  });
});
