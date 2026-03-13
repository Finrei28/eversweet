"use client";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CartContextType } from "~/app/components/cartContext";
import { useLanguage } from "~/app/components/language";
import { CustomerInfo } from "~/app/components/types";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/lib/formatters";
import { api } from "~/trpc/react";
import { getNextValidTime } from "./pick-up-time";
import { toast } from "~/hooks/use-toast";
import { format } from "date-fns";
import NotificationModal from "~/app/_components/_homeComponents/notification";

type checkoutFormProps = {
  totalPriceInCents: number;
  customerInfo: CustomerInfo;
  router: any;
  cart: CartContextType;
  pickUpTime: Date | null;
  setPickUpTime: (time: Date | null) => void;
  pickUpNextOpening: boolean;
  paymentIntentId: string | null;
};

export default function CheckoutForm({
  totalPriceInCents,
  customerInfo,
  router,
  cart,
  pickUpTime,
  setPickUpTime,
  pickUpNextOpening,
  paymentIntentId,
}: checkoutFormProps) {
  const { language } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [warned, setWarned] = useState(false);
  const [createOrderFailed, setCreateOrderFailed] = useState(false);
  const [holidayNotificationShown, setHolidayNotificationShown] =
    useState(false);
  const utils = api.useUtils();
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
    setPaymentLoading(true);
    setPaymentError("");
    try {
      await fetch("/api/updatePaymentIntent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderData, paymentIntentId }),
      });
      console.log("updated payment Intent success");
    } catch (error) {
      console.log("updated payment Intent failed");
      setCreateOrderFailed(true);
    }

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (submitError) {
      setPaymentError(
        submitError.message || "Payment failed. Please try again.",
      );
      setPaymentLoading(false);
    } else if (paymentIntent.status === "requires_action") {
      const { error: actionError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order?paymentId=${paymentIntent.id}`,
        },
        redirect: "if_required",
      });
      if (actionError) {
        setPaymentError(
          actionError.message || "Payment failed. Please try again.",
        );
      }
    }
    if (paymentIntent && paymentIntent.status === "succeeded") {
      if (createOrderFailed && paymentIntentId) {
        await createOrder.mutateAsync({
          orderData: { ...orderData, paymentIntentId },
        });
      }
      setPaymentSuccess(true);
      const orderId = await pollForOrderId();
      if (orderId) {
        cart?.clearCart();
        router.push(`/order?orderId=${orderId}`);
      }
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
      {/*  
      <NotificationModal
        open={holidayNotificationShown}
        onClose={() => setHolidayNotificationShown(false)}
        title={language === "en" ? "Announcement" : "通知"}
      >
        {language === "en"
          ? "Merry Christmas and Happy New Year from Eversweet! We will be closed on December 25th to January 16th and will be back on January 17th. Wishing you all a joyful holiday season!"
          : "Eversweet祝您圣诞快乐，新年快乐！我们将在12月25日至1月16日放假，将于1月17日正常营业。祝您节日愉快！"}
      </NotificationModal>
      */}
    </>
  );
}
