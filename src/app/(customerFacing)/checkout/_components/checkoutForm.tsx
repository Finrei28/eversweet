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

type checkoutFormProps = {
  totalPriceInCents: number;
  customerInfo: CustomerInfo;
  router: any;
  cart: CartContextType;
};

export default function CheckoutForm({
  totalPriceInCents,
  customerInfo,
  router,
  cart,
}: checkoutFormProps) {
  const { language } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);

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
      const orderId = data.id;
      await utils.order.invalidate();
      cart?.clearCart();
      router.push(`/order?orderId=${orderId}`);
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
    const nzPhoneRegex = /^\+?64[2-9]\d{7,8}$/;
    if (
      !customerInfo.firstName?.trim() ||
      !customerInfo.lastName?.trim() ||
      !customerInfo.email?.trim() ||
      !customerInfo.phone?.trim()
    ) {
      setPaymentError("Please fill in all customer information fields.");
      return;
    }

    if (!emailRegex.test(customerInfo.email.trim())) {
      setPaymentError("Please enter a valid email address.");
      return;
    }

    if (!nzPhoneRegex.test(customerInfo.phone.trim())) {
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

    if (submitError) {
      setPaymentError(
        submitError.message || "Payment failed. Please try again.",
      );
      setPaymentLoading(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      setPaymentSuccess(true);
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
        customerFirstName: customerInfo.firstName,
        customerLastName: customerInfo.lastName,
        customerEmail: customerInfo.email,
        customerPhoneNumber: customerInfo.phone,
        totalPriceInCents: totalPriceInCents,
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
            ? "Thank you for your order. You will be redirected to the confirmation page."
            : "感谢您的订购。您将被重定向至确认页面"}
        </p>
        <p className="mb-4 text-gray-500">
          {language === "en"
            ? "If not directed, you can click the button below to view your order details."
            : "如果没有指示，您可以点击下面的按钮查看您的订单详情。"}
        </p>
        <Link href="/order-confirmation">
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
