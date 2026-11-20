// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Next's own React 19, as the App Router runs it (see src/app/components/language.test.ts).
vi.mock("react", async () => await import("next/dist/compiled/react"));
vi.mock(
  "react/jsx-runtime",
  async () => await import("next/dist/compiled/react/jsx-runtime"),
);
vi.mock(
  "react/jsx-dev-runtime",
  async () => await import("next/dist/compiled/react/jsx-dev-runtime"),
);
vi.mock(
  "react-dom/client",
  async () => await import("next/dist/compiled/react-dom/client"),
);
vi.mock(
  "react-dom/server",
  async () => await import("next/dist/compiled/react-dom/server.node"),
);

// What these sections use from packages built against the React 18 in node_modules, which
// cannot render inside Next's React: stood in for by plain elements.
vi.mock("next/image", async () => {
  // "react" here is the mock above: Next's React.
  const { createElement } = await import("react");
  return {
    default: ({ src, alt }: { src: string; alt?: string }) =>
      createElement("img", { src, alt: alt ?? "" }),
  };
});
vi.mock("next/link", async () => {
  // "react" here is the mock above: Next's React.
  const { createElement } = await import("react");
  return {
    default: ({ href, children }: { href: string; children: unknown }) =>
      createElement("a", { href }, children as never),
  };
});
vi.mock("lucide-react", async (importOriginal) => {
  const icons = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(
    Object.keys(icons).map((name) => [name, () => null]),
  );
});
vi.mock("~/components/ui/button", async () => {
  // "react" here is the mock above: Next's React.
  const { createElement } = await import("react");
  return {
    Button: ({
      asChild,
      children,
      onClick,
    }: {
      asChild?: boolean;
      children: unknown;
      onClick?: () => void;
    }) =>
      asChild
        ? (children as never)
        : createElement("button", { onClick }, children as never),
  };
});
// The menu boards' sheet is Radix, closed until a board is pressed: drawn as nothing.
vi.mock("~/components/ui/sheet", () => ({
  Sheet: () => null,
  SheetCloseButton: () => null,
  SheetContent: () => null,
  SheetTitle: () => null,
}));

/**
 * The data the inner boundaries wait on. On the server it is there; in the browser it
 * arrives late, as a streamed query does, so those boundaries are still waiting to hydrate
 * when the saved language switches the rest of the page.
 */
const data = {
  arrived: false,
  promise: Promise.resolve(),
  arrive: () => undefined as void,
};
function resetData() {
  data.arrived = false;
  data.promise = new Promise<void>((resolve) => {
    data.arrive = () => {
      data.arrived = true;
      resolve();
    };
  });
}
const onServer = { now: false };

function suspenseQuery<T>(value: T) {
  return () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- how Suspense is told to wait
    if (!onServer.now && !data.arrived) throw data.promise;
    return [value] as const;
  };
}
const desserts = Array.from({ length: 8 }, (_, i) => ({
  id: `dessert-${i}`,
  name: `Dessert ${i}`,
  chineseName: `甜品 ${i}`,
  description: "",
  ingredients: [],
  priceInCents: 999,
  promo: null,
  categoryId: "category-1",
  imagePath: `https://example.com/bowl-${i}.png`,
}));
vi.mock("~/trpc/react", () => ({
  api: {
    dessert: {
      getMostPopularProducts: { useSuspenseQuery: suspenseQuery(desserts) },
    },
    store: {
      getAppPromotion: {
        useSuspenseQuery: suspenseQuery({
          pointsEarned: true,
          memberRateHigher: true,
          leaderboardShown: true,
        }),
      },
      getTradingHours: { useQuery: () => ({ data: undefined }) },
      getDaysOff: { useQuery: () => ({ data: undefined }) },
    },
  },
}));

import { act, createElement as h, type ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;

beforeEach(() => {
  resetData();
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

/**
 * Server-renders `page` in English, hydrates it with Chinese saved, and - unless the browser
 * has the data from the start - lets the late data arrive after the switch. Returns the
 * elements `pick` found in the server's HTML and what React complained about.
 */
async function hydrateInChinese(
  loadPage: () => Promise<() => ReactNode>,
  pick: (container: HTMLElement) => Element[],
  { dataLate = true } = {},
) {
  if (!dataLate) data.arrive();
  // Fresh modules, loaded together, so the section and the provider share one language
  // store and nothing saved by an earlier test is remembered.
  vi.resetModules();
  const { LanguageProvider } = await import("~/app/components/language");
  const page = await loadPage();
  const app = () => h(LanguageProvider, null, page());

  onServer.now = true;
  container.innerHTML = renderToString(app());
  onServer.now = false;
  const fromServer = pick(container);
  expect(fromServer.length).toBeGreaterThan(0);

  localStorage.setItem("lang", "zh");
  const errors: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(container, app(), {
      onRecoverableError: (error: unknown) => errors.push(error),
    });
  });
  await act(async () => {
    data.arrive();
    await data.promise;
  });
  return { fromServer, errors };
}

/**
 * What a phone paints first. React streams a Suspense boundary after the rest of the HTML,
 * hidden until a script of its own reveals it - even a boundary that has finished, once the
 * HTML before it passes 12.8KB - and it runs that script after the first paint, in batches.
 * The home page's hero sat in two: one around the whole page, with a spinner, and one round
 * the bowls. On a phone the first paint was the spinner, and the first bowl - the page's
 * largest paint - came about 400ms later.
 */
describe("the home page's first paint", () => {
  /** How many Suspense boundaries are open at `index` in server HTML. */
  const openBoundaries = (html: string, index: number) => {
    const before = html.slice(0, index);
    return (
      (before.match(/<!--\$[?!]?-->/g) ?? []).length -
      (before.match(/<!--\/\$-->/g) ?? []).length
    );
  };

  it("draws the hero's heading and bowls in no Suspense boundary", async () => {
    vi.resetModules();
    const { LanguageProvider } = await import("~/app/components/language");
    const { default: HomePage } = await import("../homePageContent");

    onServer.now = true;
    const html = renderToString(h(LanguageProvider, null, h(HomePage)));
    onServer.now = false;

    const heading = html.indexOf("<h1");
    // The first bowl: the three after the row of five, the first of them the largest.
    // Its <img>, not the preload React puts in the head for it.
    const firstBowl = html.search(/<img[^>]*bowl-5\.png/);
    expect(heading).toBeGreaterThan(-1);
    expect(firstBowl).toBeGreaterThan(-1);
    expect(openBoundaries(html, heading)).toBe(0);
    expect(openBoundaries(html, firstBowl)).toBe(0);
  });
});

describe("a section that reads the language around a boundary of its own", () => {
  it("hydrates the hero's bowls in place when the language switches", async () => {
    // The home page awaits the popular desserts, so the browser has them from the start.
    const { fromServer, errors } = await hydrateInChinese(
      async () => {
        const { Hero } = await import("./hero");
        return () => h(Hero, { onOpeningHours: () => undefined });
      },
      (c) => [...c.querySelectorAll("img")],
      { dataLate: false },
    );

    expect(container.querySelector("h1")?.textContent).toBe(
      "Somerville 的中式甜品和饮品",
    );
    // React hydrated the bowls the server drew rather than drawing them again.
    expect(errors).toEqual([]);
    expect(fromServer.every((img) => img.isConnected)).toBe(true);
  });

  it("leaves the app band's features to hydrate when the language switches", async () => {
    const { fromServer, errors } = await hydrateInChinese(
      async () => {
        const { default: GetTheApp } = await import("./get-the-app");
        return () => h(GetTheApp);
      },
      (c) => [...c.querySelectorAll("li")],
    );

    expect(container.querySelector("h2")?.textContent).toBe(
      "在 Eversweet 应用里，享受更多",
    );
    expect(errors).toEqual([]);
    expect(fromServer.every((li) => li.isConnected)).toBe(true);
    // And the features themselves switched once they had hydrated.
    expect(container.querySelector("li h3")?.textContent).toBe(
      "Sweet Points 积分",
    );
  });
});
