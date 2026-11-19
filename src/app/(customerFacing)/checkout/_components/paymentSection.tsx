"use client";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "./checkoutForm";
import { CartContextType } from "~/app/components/cartContext";
import { loadStripe } from "@stripe/stripe-js";
import { CustomerInfo } from "~/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useLanguage } from "~/app/components/language";
import { stripeAppearance } from "~/lib/stripeAppearance";
import { cn } from "~/lib/utils";
import type { PricedCart } from "./checkoutItems";

type paymentSectionProps = {
  clientSecret: string;
  pricedCart: PricedCart | null;
  onPriced: (priced: PricedCart) => void;
  onPaymentReset: () => void;
  onOrderPlaced: () => void;
  cart: CartContextType;
  customerInfo: CustomerInfo;
  /** Whether the details above are enough to start a payment (`detailsComplete`). */
  detailsReady: boolean;
  isLoading: boolean;
  error: string;
  pickUpTime: Date | null;
  setPickUpTime: (time: Date | null) => void;
  pickUpNextOpening: boolean;
  paymentIntentId: string | null;
  onServerTime: (serverNow: Date) => void;
  className?: string;
};

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

export default function PaymentSection({
  clientSecret,
  pricedCart,
  onPriced,
  onPaymentReset,
  onOrderPlaced,
  cart,
  customerInfo,
  detailsReady,
  isLoading,
  error,
  pickUpTime,
  setPickUpTime,
  pickUpNextOpening,
  paymentIntentId,
  onServerTime,
  className,
}: paymentSectionProps) {
  const { language } = useLanguage();
  const en = language === "en";
  const router = useRouter();

  // No payment is started until the details are filled in. The section used to show a
  // spinner in the meantime, as if something were loading.
  const waitingForDetails = !clientSecret && !error && !detailsReady;

  const link =
    "text-accent underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  // The documents open beside the checkout, so reading them loses nothing typed here.
  const newTab = (
    <span className="sr-only">
      {en ? " (opens in a new tab)" : "（在新标签页中打开）"}
    </span>
  );

  return (
    <section
      aria-labelledby="payment-details-heading"
      className={cn(
        "flex flex-col gap-3.5 pb-8 pt-6 lg:gap-4 lg:pb-6 lg:pt-8",
        className,
      )}
    >
      <h2
        id="payment-details-heading"
        className="text-xl font-extrabold lg:text-2xl"
      >
        {en ? "Payment details" : "付款详情"}
      </h2>

      {clientSecret && pricedCart && (
        <Elements
          key={clientSecret}
          options={{ clientSecret, appearance: stripeAppearance }}
          stripe={stripePromise}
        >
          <CheckoutForm
            clientSecret={clientSecret}
            paymentIntentId={paymentIntentId}
            pricedCart={pricedCart}
            onPriced={onPriced}
            onPaymentReset={onPaymentReset}
            onOrderPlaced={onOrderPlaced}
            onServerTime={onServerTime}
            cart={cart}
            customerInfo={customerInfo}
            pickUpTime={pickUpTime}
            setPickUpTime={setPickUpTime}
            pickUpNextOpening={pickUpNextOpening}
            router={router}
          />
        </Elements>
      )}

      {waitingForDetails && (
        <p className="rounded-[14px] bg-muted px-4 py-3.5 text-[15px] text-muted-foreground">
          {en
            ? "Fill in your information above, and the card form will appear here."
            : "请先填写上面的信息，银行卡表单将显示在这里。"}
        </p>
      )}

      {isLoading && !waitingForDetails && (
        <div className="flex justify-center py-10">
          <Loader2
            className="h-8 w-8 animate-spin text-muted-foreground"
            aria-label={en ? "Loading the card form" : "正在加载银行卡表单"}
          />
        </div>
      )}

      {error && !isLoading && (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-2 py-8 text-center"
        >
          <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
          <p className="text-[15px] font-medium text-destructive">{error}</p>
          <Button
            variant="secondary"
            size="pill-sm"
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            {en ? "Try again" : "重试"}
          </Button>
        </div>
      )}

      <p className="text-[13px] leading-normal text-muted-foreground lg:text-sm">
        {en ? (
          <>
            By completing your purchase, you agree to our{" "}
            <Link href="/terms-and-conditions" target="_blank" className={link}>
              Terms and conditions
              {newTab}
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" target="_blank" className={link}>
              Privacy policy
              {newTab}
            </Link>
            .
          </>
        ) : (
          <>
            完成购买即表示您同意我们的
            <Link href="/terms-and-conditions" target="_blank" className={link}>
              条款与条件
              {newTab}
            </Link>
            和
            <Link href="/privacy-policy" target="_blank" className={link}>
              隐私政策
              {newTab}
            </Link>
            。
          </>
        )}
      </p>
    </section>
  );
}
