"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComponentProps, useContext, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Menu, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CartContext } from "./cartContext";
import { formatCurrency } from "~/lib/formatters";

export function Navbar({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const cart = useContext(CartContext);
  const [cartQuantity, setCartQuantity] = useState<number | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const pathName = usePathname();

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

          <div className="absolute lg:left-0 xl:left-4">
            <Link href={pathName.startsWith("/admin") ? `${pathName}` : "/"}>
              <img
                src={process.env.NEXT_PUBLIC_LOGO_URL}
                alt="logo"
                className="h-32 rounded-full"
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
            pathName !== "/checkout" && (
              <div className="absolute right-4">
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
      </nav>

      {/* Mobile navbar */}
      <div className="flex w-full justify-between px-4 text-primary lg:hidden">
        <Link
          href={pathName.startsWith("/admin") ? `${pathName}` : "/"}
          className="pt-4"
        >
          <img
            src={process.env.NEXT_PUBLIC_LOGO_URL}
            alt="logo"
            className="h-20 rounded-full"
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
        {cartQuantity !== null &&
          cartQuantity > 0 &&
          pathName !== "/checkout" && (
            <div className="relative top-24 flex justify-end pr-5 md:pr-7">
              <ShoppingCart
                size={"2rem"}
                className="hover:cursor-pointer"
                onClick={() => setIsCartOpen(true)}
              />
              <span className="absolute -top-2 right-2 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
                {cartQuantity}
              </span>
            </div>
          )}
      </div>

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
      </div>

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            ref={cartRef}
            className="relative mx-4 max-h-[90vh] w-full max-w-md overflow-auto rounded-lg bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-4">
              <h2 className="text-2xl font-bold text-primary">Your Cart</h2>
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
                  {cart?.cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 border-b border-gray-100 pb-4"
                    >
                      <div className="flex flex-1 flex-col">
                        <h3 className="text-sm font-medium text-gray-900">
                          {item.dessert.name}
                        </h3>
                        {item.customisations?.map((customisation) => (
                          <p
                            className="ml-1 mt-1 items-center text-sm text-gray-500"
                            key={customisation.id}
                          >
                            {customisation.quantity > 1
                              ? `+${customisation.quantity} ${customisation.name}`
                              : customisation.quantity === 1
                                ? `+${customisation.name}`
                                : `-${customisation.name}`}
                          </p>
                        ))}
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
                        <span className="w-6 text-center">{item.quantity}</span>
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
                  ))}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                    <span className="text-base font-medium text-gray-900">
                      Subtotal
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
                        Checkout
                      </Button>
                    </Link>

                    <Button
                      variant="outline"
                      className="w-full border-primary text-primary hover:bg-primary/10"
                      onClick={() => setIsCartOpen(false)}
                    >
                      Continue Shopping
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="mb-4 h-16 w-16 text-gray-300" />
                <h3 className="mb-2 text-xl font-medium text-gray-900">
                  Your cart is empty
                </h3>
                <p className="mb-6 text-center text-gray-500">
                  Looks like you haven't added any items to your cart yet.
                </p>
                <Button
                  onClick={() => setIsCartOpen(false)}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  Start Shopping
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
