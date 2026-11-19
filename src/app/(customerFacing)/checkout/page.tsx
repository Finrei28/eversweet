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
import { PickupTimePicker } from "./_components/pick-up-time";
import { useLanguage } from "~/app/components/language";
import Loader from "~/app/components/customLoading";
import { api } from "~/trpc/react";
import { checkoutItems, type PricedCart } from "./_components/checkoutItems";
import { detailsComplete } from "./_components/customerDetails";

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
  const [pickUpAsap, setPickUpAsap] = useState(true);
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

    if (!detailsComplete(debouncedCustomerInfo)) return;

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
  //
  // Both messages sit in the page, centred in a region most of a screen tall. They used to
  // be `fixed inset-0`, centred on the viewport, which floated them over the footer once it
  // rendered on every page, and kept the footer's Contact and Feedback links from being
  // clicked under them.
  if (orderPlaced) {
    return (
      <div
        role="status"
        className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-8 py-10 text-center"
      >
        <span className="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-success-soft">
          <CheckCircle className="h-10 w-10 text-success" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold">
          {language === "en" ? "Payment successful" : "付款成功"}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {language === "en"
            ? "Thank you for your order. You will be redirected to the confirmation page shortly."
            : "感谢您的订购。您将被重定向至确认页面"}
        </p>
      </div>
    );
  }

  if (!cart?.cart || cart.cart.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-8 py-10 text-center">
        <span className="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="h-9 w-9 text-muted-foreground" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold">
          {language === "en" ? "Your cart is empty" : "您的购物车是空的"}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {language === "en"
            ? "You don't have any items in your cart yet."
            : "您的购物车中还没有任何商品"}
        </p>
        {/* A link styled as a button. It was a button inside a link, which is two
            controls in one for a keyboard and a screen reader. */}
        <Button asChild size="pill-sm" className="mt-3">
          <Link href="/menu">
            {language === "en" ? "Browse menu" : "浏览菜单"}
          </Link>
        </Button>
      </div>
    );
  }

  // One column on a phone, in the order a customer works through it: when, what, who,
  // pay. From `lg` the summary moves into a column of its own beside the other three,
  // which keep their order; the last row takes any height the summary needs beyond theirs.
  return (
    <div className="mx-auto w-full max-w-[680px] px-5 pb-4 lg:max-w-[1240px]">
      <h1 className="pb-2 pt-5 text-[30px] font-extrabold leading-tight lg:pb-6 lg:pt-10 lg:text-5xl lg:tracking-[-0.01em]">
        {language === "en" ? "Checkout" : "付款台"}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-16">
        <section
          aria-labelledby="pick-up-heading"
          className="flex flex-col gap-3.5 border-b border-border pb-7 pt-4 lg:col-start-1 lg:row-start-1 lg:gap-4 lg:pb-8 lg:pt-2"
        >
          <h2
            id="pick-up-heading"
            className="text-xl font-extrabold lg:text-2xl"
          >
            {language === "en" ? "Pick-up time" : "取货时间"}
          </h2>
          <PickupTimePicker
            value={pickUpTime}
            onChange={setPickUpTime}
            setPickUpNextOpening={setPickUpNextOpening}
            setPickUpAsap={setPickUpAsap}
            numberOfItems={cart.totalItems}
            daysOff={daysOff}
            clockSkewMs={clockSkewMs}
          />
        </section>

        <OrderSummary
          cart={cart}
          pricedCart={pricedCart}
          pickUpTime={pickUpTime}
          pickUpAsap={pickUpAsap}
          className="lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start"
        />

        <CustomerInformation
          customerInfo={customerInfo}
          handleCustomerInfoChange={handleCustomerInfoChange}
          className="lg:col-start-1 lg:row-start-2"
        />

        <PaymentSection
          clientSecret={clientSecret}
          paymentIntentId={paymentIntentId}
          pricedCart={pricedCart}
          onPriced={setPricedCart}
          onPaymentReset={resetPayment}
          onOrderPlaced={handleOrderPlaced}
          cart={cart}
          customerInfo={customerInfo}
          detailsReady={detailsComplete(customerInfo)}
          pickUpTime={pickUpTime}
          pickUpNextOpening={pickUpNextOpening}
          setPickUpTime={setPickUpTime}
          isLoading={isPaymentSectionLoading}
          error={error}
          onServerTime={handleServerTime}
          className="lg:col-start-1 lg:row-start-3 lg:self-start"
        />
      </div>
    </div>
  );
}
