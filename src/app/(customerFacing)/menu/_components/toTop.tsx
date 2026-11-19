"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

import { useCartBarShown } from "~/app/components/cartBar";
import { useLanguage } from "~/app/components/language";
import { cn } from "~/lib/utils";

/**
 * Back to the top, on every customer page but checkout. Bottom left, and lifted
 * above the cart bar while that is up, which spans the bottom of a phone's
 * screen. It used to carry the cart's count at 2xl, where the header's cart had
 * scrolled away; the cart bar shows the count at every width now.
 */
export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const { language } = useLanguage();
  const raised = useCartBarShown();

  useEffect(() => {
    const toggleVisibility = () => setIsVisible(window.scrollY > 80);

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    isVisible && (
      <button
        type="button"
        onClick={scrollToTop}
        aria-label={language === "en" ? "Back to top" : "回到顶部"}
        className={cn(
          "fixed left-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-[filter,bottom] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          raised ? "bottom-[92px] md:bottom-24" : "bottom-6",
        )}
      >
        <ArrowUp className="h-5 w-5" aria-hidden />
      </button>
    )
  );
}
