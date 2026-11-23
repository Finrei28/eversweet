// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement as h, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FormProvider, useForm } from "react-hook-form";
import { type z } from "zod";

import { LanguageProvider } from "~/app/components/language";
import { type offerFormSchema } from "~/app/components/schemas";
import RequirementsField from "./requirementsField";

/**
 * The requirements field, rendered for real with a minimum-spend row. Nothing here
 * hydrates, so it renders with the React in node_modules, which react-hook-form and the UI
 * components are built against.
 */
type OfferForm = z.infer<typeof offerFormSchema>;

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness(): ReactNode {
  const form = useForm<OfferForm>({
    defaultValues: {
      requirements: [
        {
          dessertId: null,
          categoryId: null,
          minSpendInCents: 2000,
          quantity: 1,
        },
      ],
    },
  });
  // Instantiated, since createElement cannot infer the provider's form type.
  return h(FormProvider<OfferForm>, {
    ...form,
    children: h(RequirementsField, {
      control: form.control,
      desserts: [],
      categories: [],
    }),
  });
}

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(LanguageProvider, null, h(Harness)));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const spendBox = () => {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Minimum spend"]',
  );
  if (!input) throw new Error("no minimum spend box");
  return input;
};

describe("the minimum spend box", () => {
  it("shows the amount in dollars", () => {
    expect(spendBox().value).toBe("20");
  });

  /**
   * The schema refuses these with "Enter an amount over $0." in the admin's language. The
   * box used to carry min="0.01" and step="0.01", so the browser refused 0, a negative or a
   * third decimal itself, with its own tooltip in its own language, and the form never ran
   * the schema to say why. The box rounds to the cent as it is typed.
   */
  it.each(["0", "-5", "19.999", "19.99", "1500"])(
    "leaves %s to the schema rather than the browser",
    (value) => {
      const input = spendBox();
      input.value = value;
      expect(input.checkValidity()).toBe(true);
    },
  );
});
