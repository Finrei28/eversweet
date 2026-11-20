// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The App Router runs Next's own build of React 19, not the React 18 in node_modules, and
// hydration is exactly where the two differ. Swap Next's copy in, for this file and for the
// module under test, so the test hydrates with the React the site does.
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

import { act, createElement as h, Suspense, useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

type LanguageModule = typeof import("./language");

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Each test gets a fresh module, so nothing one saves leaks into the next. */
async function loadLanguage(): Promise<LanguageModule> {
  vi.resetModules();
  return import("./language");
}

/** Data that has not arrived yet, which a component waits on by throwing the promise. */
function lateData() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  const late = {
    arrived: false,
    promise,
    arrive: () => {
      late.arrived = true;
      resolve();
    },
  };
  return late;
}
type LateData = ReturnType<typeof lateData>;

let root: Root | null = null;
let container: HTMLDivElement;

beforeEach(() => {
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
 * The home page's shape: a heading in the shell, and a section in a Suspense boundary that
 * streams in after it. `late` is that section's data. On the client the section waits for
 * it, as `useSuspenseQuery` does, by throwing its promise, while the shell hydrates.
 */
function page(lang: LanguageModule, late: LateData | null) {
  const { LanguageProvider, useLanguage } = lang;

  function Shell() {
    const { language } = useLanguage();
    return h("h1", null, language === "en" ? "Desserts" : "甜品");
  }
  function Streamed() {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- how Suspense is told to wait
    if (late && !late.arrived) throw late.promise;
    const { language } = useLanguage();
    return h("h2", null, language === "en" ? "Popular choices" : "畅销品");
  }

  return h(
    LanguageProvider,
    null,
    h(Shell),
    h(Suspense, { fallback: h("p", null, "Loading") }, h(Streamed)),
  );
}

describe("LanguageProvider", () => {
  it("hydrates a late boundary with the server's English, then shows the saved Chinese", async () => {
    localStorage.setItem("lang", "zh");
    const lang = await loadLanguage();

    // The server cannot see localStorage, so it renders English.
    container.innerHTML = renderToString(page(lang, null));
    expect(container.querySelector("h1")?.textContent).toBe("Desserts");
    const serverHeading = container.querySelector("h2");
    expect(serverHeading?.textContent).toBe("Popular choices");

    const errors: unknown[] = [];
    const late = lateData();
    await act(async () => {
      root = hydrateRoot(container, page(lang, late), {
        onRecoverableError: (error: unknown) => errors.push(error),
      });
    });
    // The shell has hydrated and switched while the section waits.
    expect(container.querySelector("h1")?.textContent).toBe("甜品");

    await act(async () => {
      late.arrive();
      await late.promise;
    });

    // React hydrated the server's section rather than throwing it away and rebuilding it,
    // which is what it does when the first client render disagrees with the server's.
    expect(errors).toEqual([]);
    expect(serverHeading?.isConnected).toBe(true);
    expect(container.querySelector("h2")).toBe(serverHeading);
    expect(serverHeading?.textContent).toBe("畅销品");
  });

  it("renders the saved language at once in a component mounted after hydration", async () => {
    localStorage.setItem("lang", "zh");
    const lang = await loadLanguage();
    const seen: string[] = [];

    function Later() {
      const { language } = lang.useLanguage();
      seen.push(language);
      return h("p", null, language);
    }
    let show: (value: boolean) => void = () => undefined;
    function App() {
      const [shown, setShown] = useState(false);
      show = setShown;
      return h(lang.LanguageProvider, null, shown ? h(Later) : null);
    }

    container.innerHTML = renderToString(h(App));
    await act(async () => {
      root = hydrateRoot(container, h(App));
    });
    // A client-side navigation: nothing is hydrating, so no English first.
    await act(async () => show(true));
    expect(seen).toEqual(["zh"]);
  });

  it("switches every component and saves the choice", async () => {
    const lang = await loadLanguage();
    let toggle: () => void = () => undefined;

    function Label({ id }: { id: string }) {
      const { language, toggleLanguage } = lang.useLanguage();
      toggle = toggleLanguage;
      return h("span", { id }, language);
    }
    const app = h(
      lang.LanguageProvider,
      null,
      h(Label, { id: "a" }),
      h(Label, { id: "b" }),
    );

    container.innerHTML = renderToString(app);
    await act(async () => {
      root = hydrateRoot(container, app);
    });
    expect(container.textContent).toBe("enen");

    await act(async () => toggle());
    expect(container.textContent).toBe("zhzh");
    expect(localStorage.getItem("lang")).toBe("zh");

    await act(async () => toggle());
    expect(container.textContent).toBe("enen");
    expect(localStorage.getItem("lang")).toBe("en");
  });

  it("keeps the language it had when saving the switch fails", async () => {
    const lang = await loadLanguage();
    let toggle: () => void = () => undefined;
    let rerender: () => void = () => undefined;

    function Label({ id }: { id: string }) {
      const { language, toggleLanguage } = lang.useLanguage();
      const [, setCount] = useState(0);
      toggle = toggleLanguage;
      if (id === "a") rerender = () => setCount((n) => n + 1);
      return h("span", { id }, language);
    }
    const app = h(
      lang.LanguageProvider,
      null,
      h(Label, { id: "a" }),
      h(Label, { id: "b" }),
    );

    container.innerHTML = renderToString(app);
    await act(async () => {
      root = hydrateRoot(container, app);
    });

    // Storage full, say: the switch throws, as it did when it was provider state.
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    try {
      await act(async () => expect(() => toggle()).toThrow("full"));
    } finally {
      setItem.mockRestore();
    }

    // One component rendering again for its own reasons must not take up a language the
    // rest never switched to.
    await act(async () => rerender());
    expect(container.textContent).toBe("enen");
  });

  it("refuses to be used outside the provider", async () => {
    const lang = await loadLanguage();
    function Orphan() {
      lang.useLanguage();
      return null;
    }
    expect(() => renderToString(h(Orphan))).toThrow(
      "useLanguage must be used within a LanguageProvider",
    );
  });
});
