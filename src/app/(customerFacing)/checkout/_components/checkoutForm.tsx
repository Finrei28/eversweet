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
  const stripe = useStripe();
  const elements = useElements();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const utils = api.useUtils();
  const createOrder = api.order.create.useMutation({
    onSuccess: async (data) => {
      const orderId = data.id;
      await utils.order.invalidate();
      cart?.clearCart();
      router.push(`/order?orderId=${orderId}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (
      !customerInfo.firstName ||
      !customerInfo.lastName ||
      !customerInfo.email ||
      !customerInfo.phone
    ) {
      setPaymentError("Please fill in all customer information fields.");
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
      cart?.cart;
      const mappedDesserts =
        cart?.cart?.map((item) => ({
          dessert: {
            id: item.id,
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
        <h3 className="mb-2 text-xl font-medium">Payment Successful!</h3>
        <p className="mb-6 text-gray-500">
          Thank you for your order. You will be redirected to the confirmation
          page.
        </p>
        <Link href="/order-confirmation">
          <Button>View Order Details</Button>
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
              Processing...
            </>
          ) : (
            `Pay ${formatCurrency(totalPriceInCents / 100)}`
          )}
        </Button>
      </div>
    </form>
  );
}
