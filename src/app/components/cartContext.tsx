"use client";

import { createContext, useState, useEffect, ReactNode, useRef } from "react";
import { dessertOnClient } from "./types";

const validPromoCategory = [
  "cm90qekmo0000k0j44vqu4tdr",
  "cm90qf2hb0000dlc9ein0forw",
  "cm90qfk4j0000149n3y3c6dlc",
];

type customisations = {
  id: string;
  chineseName: string;
  name: string;
  quantity: number;
}[];

export type CartItem = {
  id: string;
  customisations: customisations;
  dessert: dessertOnClient;
  priceInCents: number;
  quantity: number;
  promoNumber?: number;
  discountedAmountInCents: number;
};

export type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  addExtraToCart: (id: string) => void;
  removeAllSameItemFromCart: (id: string) => void;
  clearCart: () => void;
  totalPrice: number;
  totalItems: number;
  updateItemFromCart: (id: string, item: CartItem) => void;
};

export const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("cart");
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });
  const prevCartRef = useRef(cart);

  useEffect(() => {
    // Check if the cart contents actually changed
    if (JSON.stringify(prevCartRef.current) !== JSON.stringify(cart)) {
      localStorage.setItem("cart", JSON.stringify(cart));
      localStorage.setItem("cartTimestamp", Date.now().toString());
      prevCartRef.current = cart; // Update previous cart reference
    }
  }, [cart]);

  useEffect(() => {
    const timestamp = localStorage.getItem("cartTimestamp");
    if (timestamp) {
      const lastModified = parseInt(timestamp, 10);
      const now = Date.now();
      if (now - lastModified > 12 * 60 * 60 * 1000) {
        // Clear cart if older than 12 hours

        localStorage.removeItem("cart");
        localStorage.removeItem("cartTimestamp");
      }
    }
  }, []);

  const areListsEqual = (list1: customisations, list2: customisations) => {
    if (list1.length !== list2.length) return false;

    const sortedList1 = [...list1].sort((a, b) => a.id.localeCompare(b.id));
    const sortedList2 = [...list2].sort((a, b) => a.id.localeCompare(b.id));

    return sortedList1.every(
      (item, index) =>
        JSON.stringify(item) === JSON.stringify(sortedList2[index]),
    );
  };

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      let updatedItem = { ...item };
      const updatedCart = [...prev];

      // promotion logic

      if (
        validPromoCategory.includes(item.dessert.categoryId) &&
        prev.length > 0
      ) {
        const highestPromoNumber = prev.reduce(
          (max, cartItem) => Math.max(max, cartItem.promoNumber ?? max),
          0,
        );

        const nextPromoNumber = highestPromoNumber + 1;

        for (let i = 0; i < updatedCart.length; i++) {
          const cartItem = updatedCart[i]!;

          if (
            cartItem.promoNumber !== undefined ||
            cartItem.dessert.categoryId !== item.dessert.categoryId
          ) {
            continue;
          }

          // clone before mutation
          updatedCart[i] = {
            ...cartItem,
            promoNumber: nextPromoNumber,
          };

          updatedItem = {
            ...updatedItem,
            promoNumber: nextPromoNumber,
            discountedAmountInCents: Math.floor(item.dessert.priceInCents / 2),
          };

          break;
        }
      }

      // promotion logic ends

      const exists = updatedCart.find(
        (cartItem) =>
          areListsEqual(cartItem.customisations, updatedItem.customisations) &&
          cartItem.dessert.name === updatedItem.dessert.name &&
          cartItem.priceInCents === updatedItem.priceInCents &&
          cartItem.discountedAmountInCents ===
            updatedItem.discountedAmountInCents &&
          cartItem.promoNumber === updatedItem.promoNumber,
      );

      return exists
        ? updatedCart.map((cartItem) =>
            cartItem.id === exists.id
              ? {
                  ...cartItem,
                  quantity: cartItem.quantity + updatedItem.quantity,
                }
              : cartItem,
          )
        : [...updatedCart, updatedItem];
    });
  };

  const addExtraToCart = (id: string) => {
    setCart((prev) => {
      // Clone the item we’re incrementing
      let updatedCart = [...prev];

      // Find the item we just incremented
      const incrementedItem = updatedCart.find((item) => item.id === id);
      if (!incrementedItem) return updatedCart;

      // Only apply promo logic if the item is in a promo category
      if (
        validPromoCategory.includes(incrementedItem.dessert.categoryId) &&
        incrementedItem.discountedAmountInCents === 0 // only if not already discounted
      ) {
        // Find the highest existing promo number
        const highestPromoNumber = updatedCart.reduce(
          (max, item) => Math.max(max, item.promoNumber ?? max),
          0,
        );
        const nextPromoNumber = highestPromoNumber + 1;

        // Apply promo: find first eligible item in the same category
        for (let i = 0; i < updatedCart.length; i++) {
          const cartItem = updatedCart[i]!;
          if (
            cartItem.promoNumber !== undefined ||
            cartItem.dessert.categoryId !== incrementedItem.dessert.categoryId
          ) {
            continue;
          }

          updatedCart[i] = {
            ...cartItem,
            promoNumber: nextPromoNumber,
          };

          const newItem = {
            ...cartItem,
            promoNumber: nextPromoNumber,
            discountedAmountInCents: Math.floor(
              cartItem.dessert.priceInCents / 2,
            ),
          };

          // Also update the incremented item
          updatedCart = [...updatedCart, newItem];

          break;
        }
      } else {
        updatedCart = prev.map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return updatedCart;
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      // First, find the promoNumber of the item being removed (if any)
      const removedItem = prev.find((item) => item.id === id);

      const promoToClear = removedItem?.promoNumber;

      // Map over the cart to update quantities and clear promo numbers
      const updatedCart = prev
        .map((item) => {
          // 1️⃣ decrement quantity for the item being removed
          if (item.id === id) {
            return { ...item, quantity: item.quantity - 1 };
          }

          // 2️⃣ clear promo for other items with the same promo number
          if (promoToClear && item.promoNumber === promoToClear) {
            return {
              ...item,
              promoNumber: undefined,
              discountedAmountInCents: 0,
            };
          }

          return item;
        })
        // 3️⃣ remove items with quantity <= 0
        .filter((item) => item.quantity > 0);

      return updatedCart;
    });
  };

  const removeAllSameItemFromCart = (id: string) => {
    setCart((prev) => {
      const removedItem = prev.find((item) => item.id === id);
      if (!removedItem) return prev;

      const promoToRemove = removedItem.promoNumber;

      // If it has a promoNumber, remove all items with that promoNumber
      if (promoToRemove !== undefined) {
        return prev.filter((item) => item.promoNumber !== promoToRemove);
      }

      // Otherwise, just remove the item itself
      return prev.filter((item) => item.id !== id);
    });
  };

  const updateItemFromCart = (id: string, item: CartItem) => {
    setCart((prev) => {
      // Find an item with the same customisations and dessert name (but allow same ID)
      const matchesOtherItemInCart = prev.find(
        (cartItem) =>
          areListsEqual(cartItem.customisations, item.customisations) &&
          cartItem.dessert.name === item.dessert.name,
      );

      if (matchesOtherItemInCart && matchesOtherItemInCart.id !== id) {
        // If merging with another item, increase quantity and remove old item
        return prev
          .map((cartItem) =>
            cartItem.id === matchesOtherItemInCart.id
              ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
              : cartItem,
          )
          .filter((cartItem) => cartItem.id !== id); // Remove only if merging
      } else {
        // If editing the same item, update it normally
        return prev.map((cartItem) =>
          cartItem.id === id ? { ...cartItem, ...item } : cartItem,
        );
      }
    });
  };

  const clearCart = () => setCart([]);

  const totalPrice = cart.reduce(
    (total, item) =>
      total +
      (item.priceInCents - item.discountedAmountInCents) * item.quantity,
    0,
  );

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        addExtraToCart,
        removeAllSameItemFromCart,
        clearCart,
        totalPrice,
        totalItems,
        updateItemFromCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
