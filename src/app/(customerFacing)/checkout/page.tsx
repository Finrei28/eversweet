"use client";

import type React from "react";
import { useContext, useEffect, useState } from "react";
import { CartContext } from "~/app/components/cartContext";
import { Button } from "~/components/ui/button";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import PaymentSection from "./_components/paymentSection";
import CustomerInformation from "./_components/customerInformation";
import OrderSummary from "./_components/orderSummary";
import { useLanguage } from "~/app/components/language";
import Loader from "~/app/components/customLoading";

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

  const [pickUpTime, setPickUpTime] = useState<Date | null>(null);
  const [pickUpNextOpening, setPickUpNextOpening] = useState(false);

  //Check if admin wants ASAP pick up time?

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!cart?.totalPrice) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nzPhoneRegex = /^\+?64[2-9]\d{8,10}$/;
    if (
      !customerInfo.customerFirstName?.trim() ||
      !customerInfo.customerLastName?.trim() ||
      !customerInfo.customerEmail?.trim() ||
      !emailRegex.test(customerInfo.customerEmail.trim()) ||
      (customerInfo.phone && !nzPhoneRegex.test(customerInfo.phone.trim()))
    ) {
      return;
    }

    if (!pickUpTime) {
      return;
    }

    const mappedDesserts =
      cart?.cart?.map((item) => ({
        dessert: {
          id: item.dessert.id,
          quantity: item.quantity,
        },
        priceInCents: item.priceInCents,
        customisations: item.customisations, // Default to empty array if undefined
      })) ?? [];

    const orderData = {
      dessert: mappedDesserts,
      customerFirstName: customerInfo.customerFirstName,
      customerLastName: customerInfo.customerLastName,
      customerEmail: customerInfo.customerEmail,
      customerPhoneNumber: customerInfo.phone,
      totalPriceInCents: cart.totalPrice,
      pickUpTime: pickUpTime,
    };

    setIsLoading(true);
    fetch("/api/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderData }),
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
  }, [cart?.totalPrice, isClient, customerInfo, pickUpTime]);

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
    return <Loader />;
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
            setPickUpNextOpening={setPickUpNextOpening}
            pickUpNextOpening={pickUpNextOpening}
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
            pickUpNextOpening={pickUpNextOpening}
            setPickUpTime={setPickUpTime}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
