import { useContext, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { CartContext } from "~/app/components/cartContext";

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const cart = useContext(CartContext);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 200) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
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
        onClick={scrollToTop}
        className="fixed bottom-9 left-6 z-50 rounded-full bg-primary p-3 text-white shadow-lg transition hover:bg-secondary 2xl:left-auto 2xl:right-6"
      >
        <ArrowUp size={20} />
        {(cart?.totalItems ?? 0) > 0 && (
          <span className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white 2xl:flex">
            {cart?.totalItems}
          </span>
        )}
      </button>
    )
  );
}
