// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type Feedback } from "@prisma/client";

/**
 * The feedback table, rendered for real but for its query. Nothing here hydrates, so it
 * renders with the React in node_modules, which TanStack Table and the UI components are
 * built against.
 */
const rows: Feedback[] = [
  {
    id: "feedback-1",
    name: "Mei",
    email: "mei@example.com",
    feedbackMessage: "Lovely sago.",
    rating: 4,
    createdAt: new Date("2026-11-19T12:00:00Z"),
  },
  {
    id: "feedback-2",
    name: "Tui",
    email: "tui@example.com",
    feedbackMessage: "Too sweet.",
    rating: 2,
    createdAt: new Date("2026-11-18T12:00:00Z"),
  },
];
vi.mock("~/trpc/react", () => ({
  api: { feedback: { getFeedbacks: { useSuspenseQuery: () => [rows] } } },
}));

import { LanguageProvider } from "~/app/components/language";
import { DataTable } from "./data-table";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(LanguageProvider, null, h(DataTable)));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = (text: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  )!;
/** The element a column's `cell` drew, inside the `<td>` the table itself keeps. */
const cellWith = (text: string) =>
  [...container.querySelectorAll("td > *")].find(
    (el) => el.textContent?.trim() === text,
  );
/** Each row's rating, top to bottom. */
const ratings = () =>
  [...container.querySelectorAll("tbody tr")].map((row) =>
    row.querySelectorAll("td")[3]?.textContent?.trim(),
  );

/**
 * The column definitions are made once per language. Rebuilt on every render, their
 * `header` and `cell` functions were new component types each time, so React threw away
 * every header and cell and mounted new ones - on every sort and every keystroke in the
 * search box.
 */
describe("the feedback table", () => {
  it("keeps the sort button the admin pressed, and its focus", async () => {
    expect(ratings()).toEqual(["4", "2"]);
    const rating = button("rating");
    rating.focus();
    await act(async () => rating.click());

    // Sorted - so the table did render again - by the same button, still focused for the
    // next key press.
    expect(ratings()).toEqual(["2", "4"]);
    expect(rating.isConnected).toBe(true);
    expect(document.activeElement).toBe(rating);
  });

  it("keeps the rows it still shows while the search narrows", async () => {
    const meisMessage = cellWith("Lovely sago.")!;
    const search = container.querySelector("input")!;

    await act(async () => {
      // Typed as a person would: through the prototype's setter, past the one React puts
      // on the element to notice its own writes, then the input event it listens for.
      Reflect.set(HTMLInputElement.prototype, "value", "me", search);
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(cellWith("Too sweet.")).toBeUndefined();
    expect(meisMessage.isConnected).toBe(true);
  });
});
