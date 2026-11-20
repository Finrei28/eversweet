"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  ReactNode,
} from "react";

type Language = "en" | "zh";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
}

/*
 * The saved language lives in localStorage, which the server cannot read, so the server
 * renders English - and every component has to render English again while it hydrates, or
 * React finds the server's text does not match and rebuilds that part of the page.
 *
 * It used to be state in the provider, switched to the saved language in an effect. That
 * holds for whatever hydrates with the provider, but not for a Suspense boundary that
 * streams in after the shell (the home page's popular choices, an admin page behind its
 * loading.tsx). That boundary hydrates later, after the effect has switched the provider,
 * so it hydrated in Chinese against English HTML: React either logged "Hydration failed
 * because the server rendered text didn't match the client" or quietly threw the server's
 * HTML away and rendered the boundary again.
 *
 * useSyncExternalStore decides per component instead, as useHydrated in ~/lib/browserState
 * does for the cart. A component that is hydrating gets the server snapshot, English,
 * whenever it hydrates, and switches to the saved language straight after. One that mounts
 * later, after a client-side navigation, reads the saved language on its first render, so
 * the brief English is still only on a full page load.
 */
const STORAGE_KEY = "lang";
const listeners = new Set<() => void>();
let saved: Language | undefined;

function getSnapshot(): Language {
  // Read once; after that only toggleLanguage changes it, and it keeps this in step.
  return (saved ??= localStorage.getItem(STORAGE_KEY) === "zh" ? "zh" : "en");
}

function getServerSnapshot(): Language {
  return "en";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function toggleLanguage() {
  const next: Language = getSnapshot() === "en" ? "zh" : "en";
  // Saved first: if storage refuses it, nothing has switched, rather than whichever
  // component happens to render next.
  localStorage.setItem(STORAGE_KEY, next);
  saved = next;
  listeners.forEach((onChange) => onChange());
}

// Only says there is a provider above; the language itself comes from the store.
const LanguageContext = createContext(false);

export function LanguageProvider({ children }: { children: ReactNode }) {
  return (
    <LanguageContext.Provider value={true}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const insideProvider = useContext(LanguageContext);
  const language = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  if (!insideProvider) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return { language, toggleLanguage };
}
