"use client";

import type React from "react";
import { useContext, useEffect, useState } from "react";
import { CartContext } from "~/app/components/cartContext";
import { Button } from "~/components/ui/button";
import { Loader2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import PaymentSection from "./_components/paymentSection";
import CustomerInformation from "./_components/customerInformation";
import OrderSummary from "./_components/orderSummary";
import { useLanguage } from "~/app/components/language";
import { addMinutes, setSeconds } from "date-fns";

export default function CheckoutPage() {
  const cart = useContext(CartContext);
  const { language } = useLanguage();
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    phone: "",
  });
  const getNextValidTime = () => {
    const now = new Date();
    let nextTime = addMinutes(now, 15 - (now.getMinutes() % 5));
    nextTime = setSeconds(nextTime, 0);
    if (nextTime.getHours() < 10) {
      nextTime.setHours(10, 0);
    } else if (nextTime.getHours() >= 20) {
      nextTime.setHours(10, 0);
      nextTime.setDate(nextTime.getDate() + 1);
    }

    return nextTime;
  };

  const [pickUpTime, setPickUpTime] = useState<Date>(getNextValidTime());
  const [ASAP, setASAP] = useState(true); // Check if customer wants ASAP pick up time?

  //Check if admin wants ASAP pick up time?

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!cart?.totalPrice) return;

    setIsLoading(true);
    fetch("/api/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: cart?.totalPrice }),
    })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        setIsLoading(false);
      })
      .catch(() => {
        setError("Failed to initialize payment. Please try again.");
        setIsLoading(false);
      });
  }, [cart?.totalPrice, isClient]);

  const handleCustomerInfoChange = (
    value: string | React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (typeof value === "string") {
      // Handle phone input separately
      setCustomerInfo((prev) => ({
        ...prev,
        phone: value, // Store the full number (e.g., +64211234567)
      }));
    } else {
      // Handle normal input fields
      const { name, value: inputValue } = value.target;
      setCustomerInfo((prev) => ({
        ...prev,
        [name]: inputValue,
      }));
    }
  };

  // Show loading state during server rendering and initial client render
  if (!isClient) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cart?.cart || cart.cart.length === 0) {
    return (
      <div className="fixed inset-0 mx-auto my-auto flex max-h-80 max-w-xs flex-col items-center justify-center md:max-w-md">
        <ShoppingBag className="mb-4 h-16 w-16 text-gray-300" />
        <h2 className="mb-2 text-2xl font-medium">
          {language === "en" ? "Your cart is empty" : "您的购物车是空的"}
        </h2>
        <p className="mb-8 text-center text-gray-500">
          {language === "en"
            ? "You don't have any items in your cart yet."
            : "您的购物车中还没有任何商品"}
        </p>
        <Link href="/menu">
          <Button>{language === "en" ? "Browse Menu" : "浏览菜单"}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 text-center text-3xl font-bold">
        {language === "en" ? "Checkout" : "付款台"}
      </h1>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Order Summary */}
        <div>
          <OrderSummary
            cart={cart}
            pickUpTime={pickUpTime}
            setPickUpTime={setPickUpTime}
            setASAP={setASAP}
            ASAP={ASAP}
            getNextValidTime={getNextValidTime}
          />

          {/* Customer Information */}
          <CustomerInformation
            customerInfo={customerInfo}
            handleCustomerInfoChange={handleCustomerInfoChange}
          />
        </div>

        {/* Payment Section */}
        <div>
          <PaymentSection
            clientSecret={clientSecret}
            cart={cart}
            customerInfo={customerInfo}
            pickUpTime={pickUpTime}
            ASAP={ASAP}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
