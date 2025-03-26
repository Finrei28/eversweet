"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComponentProps, useContext, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Menu, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CartContext } from "./cartContext";
import { formatCurrency } from "~/lib/formatters";
import Image from "next/image";
import { Switch } from "~/components/ui/switch";
import { useLanguage } from "./language";
import { Label } from "~/components/ui/label";

export function Navbar({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const cart = useContext(CartContext);
  const [cartQuantity, setCartQuantity] = useState<number | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const pathName = usePathname();
  const { language, toggleLanguage } = useLanguage();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // Check if click is outside both the menu and the toggle button
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }

      // Check if click is outside the cart
      if (
        isCartOpen &&
        cartRef.current &&
        !cartRef.current.contains(event.target as Node)
      ) {
        setIsCartOpen(false);
      }
    };

    // Add event listener when menu or cart is open
    if (isOpen || isCartOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    // Cleanup function
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, isCartOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathName]);

  useEffect(() => {
    if (cart?.cart) {
      const total = cart.cart.reduce((acc, item) => acc + item.quantity, 0);
      setCartQuantity(total);
    }
  }, [cart?.cart]);

  return (
    <>
      {/* Desktop Navbar */}
      <nav className="hidden items-center justify-center py-10 text-primary lg:flex">
        <div className="relative mx-auto flex w-full max-w-7xl items-center px-4">
          {/* Logo */}

          <div className="absolute lg:h-28 xl:left-4 xl:h-32">
            <Link href={pathName.startsWith("/admin") ? `${pathName}` : "/"}>
              <Image
                src={process.env.NEXT_PUBLIC_LOGO_URL as string}
                alt="logo"
                width={150}
                height={150}
                className="h-full w-full rounded-full"
              />
            </Link>
          </div>

          {/* Navigation links centered */}
          <div className="flex flex-1 items-center justify-center gap-8">
            {children}
          </div>

          {/* Shopping cart */}
          {cartQuantity !== null &&
            cartQuantity > 0 &&
            pathName !== "/checkout" &&
            !pathName.startsWith("/admin") && (
              <div className="absolute right-4 hidden 2xl:flex">
                <ShoppingCart
                  size={"2rem"}
                  className="hover:cursor-pointer"
                  onClick={() => setIsCartOpen(true)}
                />
                <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
                  {cartQuantity}
                </span>
              </div>
            )}
        </div>
        {!pathName.startsWith("/admin") && (
          <div className="absolute right-10 flex items-center gap-1">
            <Label>EN</Label>
            <Switch
              onCheckedChange={toggleLanguage}
              checked={language === "en" ? false : true}
            />
            <Label>ZH</Label>
          </div>
        )}
      </nav>

      {/* Mobile navbar */}
      <div className="flex w-full justify-between px-4 text-primary lg:hidden">
        <Link
          href={pathName.startsWith("/admin") ? `${pathName}` : "/"}
          className="pt-4"
        >
          <Image
            src={process.env.NEXT_PUBLIC_LOGO_URL as string}
            alt="logo"
            width={150}
            height={150}
            className="h-full w-full rounded-full"
          />
        </Link>

        <Button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="fixed right-8 top-8 z-50 p-2 md:p-4"
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <X size={30} /> : <Menu size={30} />}
        </Button>
      </div>
      {cartQuantity !== null &&
        cartQuantity > 0 &&
        pathName !== "/checkout" &&
        !pathName.startsWith("/admin") && (
          <div className="fixed bottom-16 right-5 z-50 flex pr-5 sm:max-w-lg md:max-w-md md:pr-7 lg:max-w-lg 2xl:hidden">
            <Button
              className="border-primary bg-secondary text-base hover:cursor-pointer lg:p-6 lg:text-xl"
              onClick={() => setIsCartOpen(true)}
            >
              View Cart
            </Button>
            <span className="absolute -top-2 right-2 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
              {cartQuantity}
            </span>
          </div>
        )}

      {/* Mobile Menu */}
      <div
        ref={menuRef}
        className={cn(
          "absolute right-5 top-20 z-50 rounded-xl bg-white p-6 py-3 text-lg font-bold text-primary shadow-lg lg:hidden",
          "fixed flex transform flex-col items-center divide-y divide-secondary transition-all duration-500 ease-in-out first:pt-0 last:pb-0",
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-4 opacity-0",
        )}
      >
        {children}
        {!pathName.startsWith("/admin") && (
          <span onClick={toggleLanguage} className="py-2">
            {language === "en" ? "中文" : "English"}
          </span>
        )}
      </div>

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            ref={cartRef}
            className="relative mx-4 max-h-[90vh] w-full max-w-md overflow-auto rounded-lg bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-4">
              <h2 className="text-2xl font-bold text-primary">
                {language === "en" ? "Your Cart" : "您的购物车"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCartOpen(false)}
                className="rounded-full hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {cart && cartQuantity && cartQuantity > 0 ? (
              <>
                <div className="max-h-[50vh] space-y-4 overflow-y-auto py-2">
                  {cart?.cart.map((item) => {
                    const dessertName =
                      language === "en"
                        ? item.dessert.name
                        : item.dessert.chineseName;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 border-b border-gray-100 pb-4"
                      >
                        <div className="flex flex-1 flex-col">
                          <h3 className="text-sm font-medium text-gray-900">
                            {dessertName}
                          </h3>
                          {item.customisations?.map((customisation) => {
                            const customisationName =
                              language === "en"
                                ? customisation.name
                                : customisation.chineseName;
                            return (
                              <p
                                className="ml-1 mt-1 items-center text-sm text-gray-500"
                                key={customisation.id}
                              >
                                {customisation.quantity > 1
                                  ? `+${customisation.quantity} ${customisationName}`
                                  : customisation.quantity === 1
                                    ? `+${customisationName}`
                                    : `-${customisationName}`}
                              </p>
                            );
                          })}
                          <p className="mt-1 text-sm text-gray-500">
                            {formatCurrency(item.priceInCents / 100)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-full p-0"
                            onClick={() => cart.removeFromCart(item.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-full p-0"
                            onClick={() => cart.addExtraToCart(item.id)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => cart.removeAllItemFromCart(item.id)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                    <span className="text-base font-medium text-gray-900">
                      {language === "en" ? "Total" : "总计"}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(cart.totalPrice / 100)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={"/checkout"}>
                      <Button
                        className="w-full bg-primary text-white hover:bg-primary/90 hover:text-primary"
                        onClick={() => setIsCartOpen(false)}
                      >
                        {language === "en" ? "Checkout" : "买单"}
                      </Button>
                    </Link>

                    <Button
                      variant="outline"
                      className="w-full border-primary text-primary hover:bg-primary/10"
                      onClick={() => setIsCartOpen(false)}
                    >
                      {language === "en" ? "Continue Adding" : "继续购物"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="mb-4 h-16 w-16 text-gray-300" />
                <h3 className="mb-2 text-xl font-medium text-gray-900">
                  {language === "en"
                    ? "Your cart is empty"
                    : "您的购物车是空的"}
                </h3>
                <p className="mb-6 text-center text-gray-500">
                  {language === "en"
                    ? "Looks like you haven't added any items to your cart yet."
                    : "看起来您还没有将任何商品添加到购物车中。"}
                </p>
                <Button
                  onClick={() => setIsCartOpen(false)}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  {language === "en" ? "Start Adding" : "开始购物"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function NavbarLink(
  props: Omit<ComponentProps<typeof Link>, "className">,
) {
  const pathName = usePathname();
  return (
    <Link
      {...props}
      className={cn(
        "p-3 text-base md:p-4 md:text-lg md:hover:text-secondary lg:text-xl",
        pathName === props.href &&
          "rounded-full bg-secondary md:hover:text-primary",
      )}
    ></Link>
  );
}
