"use client";

import type React from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CartContext } from "~/app/components/cartContext";
import { Button } from "~/components/ui/button";
import { CheckCircle, ShoppingBag } from "lucide-react";
import Link from "next/link";
import PaymentSection from "./_components/paymentSection";
import CustomerInformation from "./_components/customerInformation";
import OrderSummary from "./_components/orderSummary";
import { useLanguage } from "~/app/components/language";
import Loader from "~/app/components/customLoading";
import parsePhoneNumberFromString from "libphonenumber-js";
import { api } from "~/trpc/react";
import { checkoutItems, type PricedCart } from "./_components/checkoutItems";

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
  const [pricedCart, setPricedCart] = useState<PricedCart | null>(null);
  const [customerInfo, setCustomerInfo] = useState({
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    phone: "",
  });

  const [pickUpTime, setPickUpTime] = useState<Date | null>(null);
  const [pickUpNextOpening, setPickUpNextOpening] = useState(false);
  // How far the device's clock is from the server's, learned from the server's own check
  // before paying. The picker reads its clock through this, so a phone a few minutes slow
  // does not keep offering an ASAP the server keeps refusing.
  const [clockSkewMs, setClockSkewMs] = useState(0);
  const handleServerTime = useCallback((serverNow: Date) => {
    setClockSkewMs(serverNow.getTime() - Date.now());
  }, []);
  const [debouncedCustomerInfo, setDebouncedCustomerInfo] =
    useState(customerInfo);
  const [isPaymentIntentInitialized, setIsPaymentIntentInitialized] =
    useState(false);
  const creatingPayment = useRef(false);
  // Set as the payment form empties the cart on its way to the order.
  const [orderPlaced, setOrderPlaced] = useState(false);
  const handleOrderPlaced = useCallback(() => setOrderPlaced(true), []);

  // Drops a payment that can no longer be paid with - its hold released, refunded or expired,
  // or confirmed already when the cart changed - so the effect below creates a new one.
  const resetPayment = useCallback(() => {
    setClientSecret("");
    setPaymentIntentId(null);
    setPricedCart(null);
    setError("");
    setIsPaymentIntentInitialized(false);
  }, []);

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

    // One payment at a time. Details that change while one is being created would otherwise
    // create a second, and whichever answered last would replace the payment form - clearing
    // a card the customer had started typing.
    if (creatingPayment.current) return;
    creatingPayment.current = true;

    setPaymentSectionLoading(true);

    // Send what is in the cart, not what it costs - the server prices it. The payment form
    // reprices the payment if the cart changes after this.
    const items = checkoutItems(cart?.cart ?? []);
    const couldNotStart =
      language === "en"
        ? "We couldn't start your payment. Please try again."
        : "无法开始付款，请重试。";

    fetch("/api/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    })
      .then(async (res) => {
        // A server that fell over answers with a page, not JSON: say so in our words rather
        // than show the parser's.
        const data = (await res.json().catch(() => null)) as {
          clientSecret?: string;
          paymentIntentId?: string;
          totalInCents?: number;
          error?: string;
        } | null;
        if (
          !res.ok ||
          !data?.clientSecret ||
          !data.paymentIntentId ||
          typeof data.totalInCents !== "number"
        ) {
          // The server's own message is for the customer when it refused the cart - an item
          // sold out or removed.
          throw new Error(
            res.status === 400 && data?.error ? data.error : couldNotStart,
          );
        }
        return data as {
          clientSecret: string;
          paymentIntentId: string;
          totalInCents: number;
        };
      })
      .then((data) => {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setPricedCart({
          key: JSON.stringify(items),
          amountInCents: data.totalInCents,
        });
        setError("");
        setIsPaymentIntentInitialized(true);
        setPaymentSectionLoading(false);
      })
      .catch((err: unknown) => {
        console.error("Could not start the payment:", err);
        setError(
          err instanceof Error && err.message ? err.message : couldNotStart,
        );
        setPaymentSectionLoading(false);
      })
      .finally(() => {
        creatingPayment.current = false;
      });
    // Every value the effect reads to decide, so none of them can change without it looking
    // again. `pickUpTime` especially: the picker can settle on a time after the details are
    // already filled in, and without it here that payment would never be created - the
    // customer would sit in front of a spinner until they touched a field. The guards above
    // are what stop a second payment, not a short dependency list.
  }, [
    cart?.cart,
    cart?.totalPrice,
    pickUpTime,
    isClient,
    debouncedCustomerInfo,
    isPaymentIntentInitialized,
    language,
  ]);

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

  // Before the empty-cart check: the cart is emptied the moment the order is placed, and the
  // customer should see that it was, not "Your cart is empty", until the order page loads.
  if (orderPlaced) {
    return (
      <div className="fixed inset-0 mx-auto my-auto flex max-h-80 max-w-xs flex-col items-center justify-center text-center md:max-w-md">
        <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
        <h2 className="mb-2 text-2xl font-medium">
          {language === "en" ? "Payment Successful!" : "付款成功！"}
        </h2>
        <p className="text-gray-500">
          {language === "en"
            ? "Thank you for your order. You will be redirected to the confirmation page shortly."
            : "感谢您的订购。您将被重定向至确认页面"}
        </p>
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
            pricedCart={pricedCart}
            pickUpTime={pickUpTime}
            setPickUpTime={setPickUpTime}
            setPickUpNextOpening={setPickUpNextOpening}
            clockSkewMs={clockSkewMs}
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
            pricedCart={pricedCart}
            onPriced={setPricedCart}
            onPaymentReset={resetPayment}
            onOrderPlaced={handleOrderPlaced}
            cart={cart}
            customerInfo={customerInfo}
            pickUpTime={pickUpTime}
            pickUpNextOpening={pickUpNextOpening}
            setPickUpTime={setPickUpTime}
            isLoading={isPaymentSectionLoading}
            error={error}
            onServerTime={handleServerTime}
          />
        </div>
      </div>
    </div>
  );
}
