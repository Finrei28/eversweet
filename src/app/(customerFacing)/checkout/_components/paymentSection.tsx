"use client";
import { Elements } from "@stripe/react-stripe-js";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import CheckoutForm from "./checkoutForm";
import { CartContextType } from "~/app/components/cartContext";
import { loadStripe } from "@stripe/stripe-js";
import { CustomerInfo } from "~/app/components/types";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";

type paymentSectionProps = {
  clientSecret: string;
  cart: CartContextType;
  customerInfo: CustomerInfo;
  isLoading: boolean;
  error: string;
};

export default function PaymentSection({
  clientSecret,
  cart,
  customerInfo,
  isLoading,
  error,
}: paymentSectionProps) {
  const router = useRouter();
  const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY as string,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
      </CardHeader>
      <CardContent>
        {clientSecret && (
          <Elements options={{ clientSecret }} stripe={stripePromise}>
            <CheckoutForm
              cart={cart}
              totalPriceInCents={cart.totalPrice || 0}
              customerInfo={customerInfo}
              router={router}
            />
          </Elements>
        )}

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="text-red-500">{error}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-4 text-sm text-gray-500">
        <p className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          Secure payment processing
        </p>
        <p>
          By completing your purchase, you agree to our Terms of Service and
          Privacy Policy.
        </p>
      </CardFooter>
    </Card>
  );
}
