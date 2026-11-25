// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * The offer dialog's prices, rendered for real with the React in node_modules, as the parts
 * field's test is. The router is stood in for: the dialog reads the menu through it and
 * saves through its mutations, and the save is what these check.
 */
const { menu, updateMutate, createMutate } = vi.hoisted(() => ({
  menu: {
    desserts: [
      {
        id: "taro",
        name: "Taro Mochi Bowl",
        chineseName: "芋泥麻糬",
        priceInCents: 1050,
        category: { id: "mochi" },
      },
    ],
    categories: [{ id: "mochi", name: "Mochi Series", chineseName: "麻糬系列" }],
  },
  updateMutate: vi.fn(),
  createMutate: vi.fn(),
}));

vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ offer: { invalidate: vi.fn() } }),
    dessert: {
      getProducts: { useSuspenseQuery: () => [menu.desserts] },
      getCategories: { useSuspenseQuery: () => [menu.categories] },
    },
    offer: {
      createOffer: { useMutation: () => ({ mutate: createMutate, isPending: false }) },
      updateOffer: { useMutation: () => ({ mutate: updateMutate, isPending: false }) },
    },
  },
}));

import { LanguageProvider } from "~/app/components/language";
import { type OfferRow } from "../columns";
import OfferDialog from "./offerDialog";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Radix measures some parts of the dialog with it, and jsdom has none.
globalThis.ResizeObserver ??= class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
} as unknown as typeof ResizeObserver;

/** A running single offer: the Taro Mochi Bowl at a fixed $8.50. */
const taroAt850 = {
  id: "offer-1",
  name: "Taro for less",
  description: null,
  image: null,
  isActive: true,
  startsAt: null,
  endsAt: null,
  archivedAt: null,
  audience: "EVERYONE",
  dessert: { id: "taro", name: "Taro Mochi Bowl", chineseName: "芋泥麻糬" },
  category: null,
  excludedDessertIds: [],
  itemPriceInCents: 850,
  discountAmount: null,
  comboPriceInCents: null,
  comboSlots: [],
  limit: 1,
  renewsWeekly: false,
  requirements: [],
} as unknown as OfferRow;

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  updateMutate.mockClear();
  createMutate.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      h(
        LanguageProvider,
        null,
        h(OfferDialog, { open: true, onOpenChange: () => undefined, offer: taroAt850 }),
      ),
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The box under the "Fixed price" label. The dialog renders in a portal on the body. */
const fixedPriceBox = () => {
  const label = [...document.body.querySelectorAll("label")].find((l) =>
    l.textContent?.startsWith("Fixed price"),
  );
  const input = label?.parentElement?.querySelector("input");
  if (!input) throw new Error("no Fixed price box");
  return input;
};

/** As a person types: React reads the value through the native setter's input event. */
const type = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    // The prototype's setter, not `input.value =`, which React's own tracker would swallow.
    Reflect.set(HTMLInputElement.prototype, "value", value, input);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const save = async () => {
  const button = [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Save offer",
  );
  if (!button) throw new Error("no Save offer button");
  await act(async () => button.click());
};

// It was typed in cents, beside a combo price and a minimum spend typed in dollars, so an
// admin typing "8.50" there saved an 8-cent offer - or nothing, as the schema wants whole cents.
describe("the fixed price", () => {
  it("shows the stored price in dollars", () => {
    expect(fixedPriceBox().value).toBe("8.5");
  });

  it("is typed in dollars and saved in cents", async () => {
    await type(fixedPriceBox(), "7.50");
    await save();

    await vi.waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0]?.[0]).toMatchObject({
      offer: { id: "offer-1", itemPriceInCents: 750 },
    });
  });

  it("rounds to the cent as it is typed", async () => {
    await type(fixedPriceBox(), "9.99");
    await save();

    await vi.waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0]?.[0]).toMatchObject({
      offer: { itemPriceInCents: 999 },
    });
  });
});
