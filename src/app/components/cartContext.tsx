"use client";

import { createContext, useState, useEffect, ReactNode } from "react";

type CartItem = {
  id: string;
  customisations: {
    id: string;
    name: string;
    quantity: number;
  }[];
  dessert: {
    description: string;
    name: string;
    id: string;
    chineseName: string;
    priceInCents: number;
    imagePath: string;
    ingredients: string[];
  };
  priceInCents: number;
  quantity: number;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  addExtraToCart: (id: string) => void;
  removeAllItemFromCart: (id: string) => void;
  clearCart: () => void;
  totalPrice: number;
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

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const areListsEqual = (list1: any[], list2: any[]) => {
        if (list1.length !== list2.length) return false;

        const sortedList1 = [...list1].sort((a, b) => a.id.localeCompare(b.id));
        const sortedList2 = [...list2].sort((a, b) => a.id.localeCompare(b.id));

        return sortedList1.every(
          (item, index) =>
            JSON.stringify(item) === JSON.stringify(sortedList2[index]),
        );
      };
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

  const removeAllItemFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id != id));
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
        removeAllItemFromCart,
        clearCart,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
