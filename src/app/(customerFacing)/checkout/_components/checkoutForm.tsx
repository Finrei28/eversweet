"use client";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { CartContextType } from "~/app/components/cartContext";
import { useLanguage } from "~/app/components/language";
import { CustomerInfo } from "~/lib/types";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/lib/formatters";
import { api } from "~/trpc/react";
import { toast } from "~/hooks/use-toast";
import parsePhoneNumberFromString from "libphonenumber-js";
import { formatNZ } from "~/lib/pickUpTimes";

type checkoutFormProps = {
  totalPriceInCents: number;
  customerInfo: CustomerInfo;
  router: any;
  cart: CartContextType;
  pickUpTime: Date | null;
  setPickUpTime: (time: Date | null) => void;
  pickUpNextOpening: boolean;
  clientSecret: string;
  paymentIntentId: string | null;
  onServerTime: (serverNow: Date) => void;
};

export default function CheckoutForm({
  totalPriceInCents,
  customerInfo,
  router,
  cart,
  pickUpTime,
  setPickUpTime,
  pickUpNextOpening,
  clientSecret,
  paymentIntentId,
  onServerTime,
}: checkoutFormProps) {
  const { language } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [warned, setWarned] = useState(false);
  const utils = api.useUtils();
  const { mutateAsync: checkPickUpTime } =
    api.store.checkPickUpTime.useMutation();
  const createOrder = api.order.createNewOrder.useMutation({
    onSuccess: async () => {
      await utils.order.invalidate();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: language === "en" ? "Order Failed" : "订单失败",
        description:
          language === "en"
            ? "Your order failed to sent to the kitchen, Please take a photo of this."
            : "您的订单未能成功发送到厨房，请拍照保存此信息。",
      });
    },
  });

  let dessertIds = [...new Set(cart.cart.map((dessert) => dessert.dessert.id))];

  let customisationIds = [
    ...new Set(
      cart.cart.flatMap((dessert) =>
        dessert.customisations.map((customisation) => customisation.id),
      ),
    ),
  ];

  const { error, refetch } = api.dessert.scanCart.useQuery(
    { dessertIds, customisationIds },
    { enabled: false }, // Prevents automatic execution
  );

  const { refetch: refetchOrderId } =
    api.order.findOrderWithPaymentIntentId.useQuery(
      { id: paymentIntentId ?? "" },
      { enabled: false },
    );

  const pollForOrderId = (interval = 5000) => {
    return new Promise<string>((resolve, reject) => {
      const poll = setInterval(() => {
        void (async () => {
          try {
            const { data: orderId } = await refetchOrderId();

            if (orderId) {
              clearInterval(poll);
              resolve(orderId);
            }
          } catch (err) {
            clearInterval(poll);
            reject(
              err instanceof Error
                ? err
                : new Error("Polling for order failed"),
            );
          }
        })();
      }, interval);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickUpTime) {
      // setHolidayNotificationShown(true); // delete after holiday
      return;
    }

    setPaymentError("");

    dessertIds = [...new Set(cart.cart.map((dessert) => dessert.dessert.id))];

    customisationIds = [
      ...new Set(
        cart.cart.flatMap((dessert) =>
          dessert.customisations.map((customisation) => customisation.id),
        ),
      ),
    ];

    refetch();

    if (!stripe || !elements) {
      return;
    }

    if (error) {
      setPaymentError(error.message);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phone = parsePhoneNumberFromString(customerInfo.phone, "NZ");
    if (
      !customerInfo.customerFirstName?.trim() ||
      !customerInfo.customerLastName?.trim() ||
      !customerInfo.customerEmail?.trim()
    ) {
      setPaymentError("Please fill in all customer information fields.");
      return;
    }

    if (!emailRegex.test(customerInfo.customerEmail.trim())) {
      setPaymentError("Please enter a valid email address.");
      return;
    }

    if (!phone?.isValid()) {
      setPaymentError("Please enter a valid New Zealand phone number.");
      return;
    }

    if (cart.cart.length === 0) {
      return;
    }

    if (!pickUpTime) {
      setPaymentError("Please select a pick up time.");
      return;
    }
    // The last gate before payment, and the server decides it: the same rule as the
    // picker, on the shop's hours and days off as they stand now. This used to be a
    // check in the browser that swapped in a new time when the chosen one was too soon
    // and then paid with the old one anyway - unless the new time happened to be on
    // another day. Any change now stops here, so the customer sees the time they are
    // paying for before they pay for it.
    //
    // It is sent the payment, not the cart's size: the server reads how many items that
    // payment is for from what it recorded when pricing the cart.
    setPaymentLoading(true);
    const check = paymentIntentId
      ? await checkPickUpTime({ pickUpTime, paymentIntentId }).catch(() => null)
      : null;
    setPaymentLoading(false);

    if (!check) {
      setPaymentError(
        language === "en"
          ? "We couldn't confirm your pick up time. Please try again."
          : "无法确认您的取货时间，请重试。",
      );
      return;
    }

    // Before anything else, so the picker's next ASAP is worked out on the server's clock
    // and agrees with the time about to be set.
    onServerTime(check.serverNow);

    if (!check.ok) {
      setPickUpTime(check.asap);
      if (check.asap) {
        toast({
          title:
            language === "en"
              ? "Your pick up time has changed!"
              : "您的取货时间已更改！",
          description:
            check.reason === "too-soon"
              ? `${
                  language === "en"
                    ? "The soonest we can have your order ready is"
                    : "我们最早可以准备好您订单的时间是"
                } ${formatNZ(check.asap, "EEE dd/MM/yyyy h:mm a")}`
              : `${
                  language === "en"
                    ? "We can't take a pick up at that time. The soonest we can is"
                    : "该时间无法取货。最早可取货时间是"
                } ${formatNZ(check.asap, "EEE dd/MM/yyyy h:mm a")}`,
          variant: "destructive",
        });
      } else {
        setPaymentError(
          language === "en"
            ? "We're not taking pick up orders at the moment."
            : "我们目前不接受取货订单。",
        );
      }
      return;
    }

    if (pickUpNextOpening && !warned) {
      toast({
        title:
          language === "en"
            ? "your pick up time is on another day!"
            : "看来您的取货时间是在其他天！",
        description: `${
          language === "en"
            ? "Please check your intended pick up date is at"
            : "请确认您预计的取货日期是"
        } ${formatNZ(pickUpTime, "EEE dd/MM/yyyy h:mm a")}`,
        variant: "destructive",
        duration: Infinity,
      });
      setWarned(true);
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
        discountedAmountInCents: item.discountedAmountInCents,
        promoId: item.dessert.promo ? item.dessert.promo.id : null,
      })) ?? [];

    const orderData = {
      desserts: mappedDesserts,
      customerFirstName: customerInfo.customerFirstName,
      customerLastName: customerInfo.customerLastName,
      customerEmail: customerInfo.customerEmail,
      customerPhoneNumber: customerInfo.phone,
      totalPriceInCents,
      pickUpTime,
    };

    try {
      setPaymentLoading(true);
      setPaymentError("");

      const { error: submitError, paymentIntent } = await stripe.confirmPayment(
        {
          elements,
          redirect: "if_required",
        },
      );

      if (submitError) {
        setPaymentError(
          submitError.message || "Payment failed. Please try again.",
        );
      }
      if (paymentIntent && paymentIntent.status === "succeeded") {
        // Now that the payment has gone through, put these details on it as its
        // Stripe customer, so the Stripe Dashboard shows who paid. Only that label
        // is at stake - the order records the customer either way - so it runs
        // alongside the order rather than ahead of it, and a failure is only
        // logged. `keepalive` lets it finish if the page moves on first.
        void fetch("/api/updatePaymentIntent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientSecret,
            customer: {
              firstName: customerInfo.customerFirstName,
              lastName: customerInfo.customerLastName,
              email: customerInfo.customerEmail,
              phone: customerInfo.phone,
            },
          }),
          keepalive: true,
        })
          .then((res) => {
            if (!res.ok) {
              console.error(
                "Could not record customer details on the payment:",
                res.status,
              );
            }
          })
          .catch((error: unknown) => {
            console.error(
              "Could not record customer details on the payment:",
              error,
            );
          });

        await createOrder.mutateAsync({
          orderData: { ...orderData, paymentIntentId: paymentIntentId ?? "" },
        });

        setPaymentSuccess(true);
        const orderId = await pollForOrderId();
        if (orderId) {
          cart?.clearCart();
          router.push(`/order?orderId=${orderId}`);
        }
      }
    } catch (error) {
      setPaymentError((error as Error).message);
    } finally {
      setPaymentLoading(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
        <h3 className="mb-2 text-xl font-medium">
          {language === "en" ? "Payment Successful!" : "付款成功！"}
        </h3>
        <p className="mb-6 text-gray-500">
          {language === "en"
            ? "Thank you for your order. You will be redirected to the confirmation page shortly."
            : "感谢您的订购。您将被重定向至确认页面"}
        </p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <PaymentElement />

          {paymentError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
              {paymentError}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!stripe || !elements || paymentLoading}
          >
            {paymentLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {language === "en" ? "Processing..." : "正在处理"}
              </>
            ) : (
              `${language === "en" ? "Pay " : "支付 "}${formatCurrency(totalPriceInCents / 100)}`
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
