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
import parsePhoneNumberFromString from "libphonenumber-js";
import { api } from "~/trpc/react";

export default function CheckoutPage() {
  const cart = useContext(CartContext);
  const { data: daysOff = [], isLoading: loadingDaysOff } =
    api.store.getDaysOff.useQuery();
  const { language } = useLanguage();
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");
  const [isPaymentSectionLoading, setPaymentSectionLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState({
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    phone: "",
  });

  const [pickUpTime, setPickUpTime] = useState<Date | null>(null);
  const [pickUpNextOpening, setPickUpNextOpening] = useState(false);
  const [debouncedCustomerInfo, setDebouncedCustomerInfo] =
    useState(customerInfo);
  const [isPaymentIntentInitialized, setIsPaymentIntentInitialized] =
    useState(false);

  //Check if admin wants ASAP pick up time?

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCustomerInfo(customerInfo);
    }, 500); // wait 500ms after typing stops

    return () => clearTimeout(handler); // cancel previous timeout if typing continues
  }, [customerInfo]);

  useEffect(() => {
    if (isPaymentIntentInitialized) return; // Prevent re-initialization
    if (!cart?.totalPrice) return;
    if (!pickUpTime) return; // delete after holiday

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phone = parsePhoneNumberFromString(debouncedCustomerInfo.phone, "NZ");
    if (
      !debouncedCustomerInfo.customerFirstName?.trim() ||
      !debouncedCustomerInfo.customerLastName?.trim() ||
      !debouncedCustomerInfo.customerEmail?.trim() ||
      !emailRegex.test(debouncedCustomerInfo.customerEmail.trim()) ||
      !phone?.isValid()
    ) {
      return;
    }

    setPaymentSectionLoading(true);

    // Send what is in the cart, not what it costs - the server prices it.
    fetch("/api/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items:
          cart?.cart?.map((item) => ({
            dessertId: item.dessert.id,
            quantity: item.quantity,
            customisations: item.customisations.map((customisation) => ({
              id: customisation.id,
              quantity: customisation.quantity,
            })),
          })) ?? [],
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to initialize");
        return data;
      })
      .then((data) => {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setIsPaymentIntentInitialized(true);
        setPaymentSectionLoading(false);
      })
      .catch((err: Error) => {
        setError(
          err.message || "Failed to initialize payment. Please try again.",
        );
        setPaymentSectionLoading(false);
      });
  }, [cart?.totalPrice, isClient, debouncedCustomerInfo]);

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

  if (!isClient || loadingDaysOff) {
    // Show loading state during server rendering and initial client render
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
            daysOff={daysOff}
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
            paymentIntentId={paymentIntentId}
            cart={cart}
            customerInfo={customerInfo}
            pickUpTime={pickUpTime}
            pickUpNextOpening={pickUpNextOpening}
            setPickUpTime={setPickUpTime}
            isLoading={isPaymentSectionLoading}
            error={error}
            daysOff={daysOff}
          />
        </div>
      </div>
    </div>
  );
}
