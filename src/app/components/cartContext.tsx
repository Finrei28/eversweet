"use client";

import { createContext, useState, useEffect, ReactNode, useRef } from "react";
import { dessertOnClient } from "./types";

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
};

export type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  addExtraToCart: (id: string) => void;
  removeAllSameItemFromCart: (id: string) => void;
  clearCart: () => void;
  totalPrice: number;
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
      const exists = prev.find(
        (cartItem) =>
          areListsEqual(cartItem.customisations, item.customisations) &&
          cartItem.dessert.name === item.dessert.name,
      );

      return exists
        ? prev.map((cartItem) =>
            cartItem.id === exists.id
              ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
              : cartItem,
          )
        : [...prev, { ...item, quantity: item.quantity }];
    });
  };

  const addExtraToCart = (id: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeAllSameItemFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id != id));
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
    (total, item) => total + item.priceInCents * item.quantity,
    0,
  );

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
        updateItemFromCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
