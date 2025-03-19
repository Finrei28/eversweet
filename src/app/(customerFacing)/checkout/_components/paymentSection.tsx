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
import { useLanguage } from "~/app/components/language";

type paymentSectionProps = {
  clientSecret: string;
  cart: CartContextType;
  customerInfo: CustomerInfo;
  isLoading: boolean;
  error: string;
};

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

export default function PaymentSection({
  clientSecret,
  cart,
  customerInfo,
  isLoading,
  error,
}: paymentSectionProps) {
  const { language } = useLanguage();
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
      </CardHeader>
      <CardContent>
        {clientSecret && (
          <Elements
            key={clientSecret}
            options={{ clientSecret }}
            stripe={stripePromise}
          >
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
              {language === "en" ? "Try Again" : "重试"}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-4 text-sm text-gray-500">
        <p className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          {language === "en" ? "Secure payment processing" : "安全支付处理"}
        </p>
        <p>
          {language === "en"
            ? "By completing your purchase, you agree to our Terms of Service and Privacy Policy."
            : "完成购买即表示您同意我们的服务条款和隐私政策。"}
        </p>
      </CardFooter>
    </Card>
  );
}
