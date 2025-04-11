"use client";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CartContextType } from "~/app/components/cartContext";
import { useLanguage } from "~/app/components/language";
import { CustomerInfo } from "~/app/components/types";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/lib/formatters";
import { api } from "~/trpc/react";
import { getNextValidTime } from "./pick-up-time";
import { toast } from "~/hooks/use-toast";
import { format } from "date-fns";

type checkoutFormProps = {
  totalPriceInCents: number;
  customerInfo: CustomerInfo;
  router: any;
  cart: CartContextType;
  pickUpTime: Date | null;
  setPickUpTime: (time: Date) => void;
  pickUpNextOpening: boolean;
};

export default function CheckoutForm({
  totalPriceInCents,
  customerInfo,
  router,
  cart,
  pickUpTime,
  setPickUpTime,
  pickUpNextOpening,
}: checkoutFormProps) {
  const { language } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [warned, setWarned] = useState(false);

  let dessertIds = [...new Set(cart.cart.map((dessert) => dessert.dessert.id))];

  let customisationIds = [
    ...new Set(
      cart.cart.flatMap((dessert) =>
        dessert.customisations.map((customisation) => customisation.id),
      ),
    ),
  ];

  const utils = api.useUtils();
  const createOrder = api.order.create.useMutation({
    onSuccess: async (data) => {
      setPaymentSuccess(true);
      cart?.clearCart();
      const orderId = data.id;
      setOrderId(orderId);
      await utils.order.invalidate();
      setTimeout(() => {
        router.push(`/order?orderId=${orderId}`);
      }, 3000);
    },
  });

  const { error, refetch } = api.dessert.scanCart.useQuery(
    { dessertIds, customisationIds },
    { enabled: false }, // Prevents automatic execution
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const nzPhoneRegex = /^\+?64[2-9]\d{8,10}$/;
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

    if (customerInfo.phone && !nzPhoneRegex.test(customerInfo.phone.trim())) {
      setPaymentError("Please enter a valid New Zealand phone number.");
      return;
    }

    if (cart.cart.length === 0) {
      return;
    }

    setPaymentLoading(true);
    setPaymentError("");
    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation`,
      },
      redirect: "if_required",
    });

    if (!pickUpTime) {
      setPaymentError("Please select a pick up time.");
      return;
    }
    const now = new Date();
    const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000);
    let newPickUpTime = null;
    if (pickUpTime.getTime() < tenMinutesLater.getTime()) {
      setPickUpTime(getNextValidTime());
      newPickUpTime = getNextValidTime();
      const isToday =
        newPickUpTime?.getDate() === now.getDate() &&
        newPickUpTime?.getMonth() === now.getMonth() &&
        newPickUpTime?.getFullYear() === now.getFullYear();

      if (!isToday && newPickUpTime && !warned) {
        toast({
          title:
            language === "en"
              ? "Your pick up time has changed!"
              : "您的取货时间已更改！",
          description: `${
            language === "en" ? "Your pick up time is" : "您的取货时间是"
          } ${format(pickUpTime, "dd/MM/yyyy h:mm a")}`,
          variant: "destructive",
        });
        setWarned(true);
        return;
      }
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
        } ${format(pickUpTime, "dd/MM/yyyy h:mm a")}`,
        variant: "destructive",
        duration: Infinity,
      });
      setWarned(true);
    }

    console.log(newPickUpTime);

    if (submitError) {
      setPaymentError(
        submitError.message || "Payment failed. Please try again.",
      );
      setPaymentLoading(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      const mappedDesserts =
        cart?.cart?.map((item) => ({
          dessert: {
            id: item.dessert.id,
            quantity: item.quantity,
          },
          priceInCents: item.priceInCents,
          customisations: item.customisations, // Default to empty array if undefined
        })) ?? [];

      createOrder.mutate({
        dessert: mappedDesserts,
        customerFirstName: customerInfo.customerFirstName,
        customerLastName: customerInfo.customerLastName,
        customerEmail: customerInfo.customerEmail,
        customerPhoneNumber: customerInfo.phone,
        totalPriceInCents: totalPriceInCents,
        pickUpTime: newPickUpTime ? newPickUpTime : (pickUpTime as Date),
      });
    } else {
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
        <p className="mb-4 text-gray-500">
          {language === "en"
            ? "If not directed, you can click the button below to view your order details."
            : "如果没有指示，您可以点击下面的按钮查看您的订单详情。"}
        </p>
        <Link href={`/order?orderId=${orderId}`}>
          <Button>
            {language === "en" ? "View Order Details" : "查看订单详情"}
          </Button>
        </Link>
      </div>
    );
  }

  return (
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
  );
}
