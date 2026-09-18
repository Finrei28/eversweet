"use client";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type {
  PaymentIntentResult,
  Stripe,
  StripeElements,
} from "@stripe/stripe-js";
import { TRPCClientError } from "@trpc/client";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CartContextType } from "~/app/components/cartContext";
import { createOrderSchema } from "~/app/components/schemas";
import { useLanguage } from "~/app/components/language";
import { CustomerInfo } from "~/lib/types";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/lib/formatters";
import { api } from "~/trpc/react";
import { toast } from "~/hooks/use-toast";
import parsePhoneNumberFromString from "libphonenumber-js";
import { formatNZ } from "~/lib/pickUpTimes";
import type { OrderRefusal } from "~/server/websiteOrder";
import { checkoutCartKey, type PricedCart } from "./checkoutItems";

type checkoutFormProps = {
  customerInfo: CustomerInfo;
  router: any;
  cart: CartContextType;
  pickUpTime: Date | null;
  setPickUpTime: (time: Date | null) => void;
  pickUpNextOpening: boolean;
  clientSecret: string;
  paymentIntentId: string | null;
  /** The cart the payment is priced for, and its amount. Held by the page, which shows it
   * in the order summary too, so one number is on screen and on the payment. */
  pricedCart: PricedCart;
  /** The payment now stands for this cart, at this amount. */
  onPriced: (priced: PricedCart) => void;
  /** Drops this payment for a new one, once it can no longer be paid with. */
  onPaymentReset: () => void;
  /** An order has been placed: the page shows it is, whatever the cart now holds. */
  onOrderPlaced: () => void;
  onServerTime: (serverNow: Date) => void;
};

/** How long the cart has to stay still before the payment is repriced for it. */
const REPRICE_DEBOUNCE_MS = 400;

/** How long to wait before trying again after a repricing that failed for no stated reason. */
const REPRICE_RETRY_MS = 3000;

/**
 * What asking the server to reprice the payment came to.
 *
 * - `priced`: the payment is for the cart sent, at `amountInCents`.
 * - `already-ordered`: this payment's order was placed after all, by a call whose answer was
 *   lost. Its id comes back so the checkout can finish that order and go to it.
 * - `unsellable`: something in the cart cannot be sold; the reason is on screen.
 * - `replaced`: the payment could not be repriced and has been dealt with - the checkout has
 *   moved on to a new payment. Nothing more to do on this form.
 * - `failed`: no usable answer. The payment is as it was.
 */
type RepriceOutcome =
  | { kind: "priced"; amountInCents: number }
  | { kind: "already-ordered"; orderId: string }
  | { kind: "unsellable" }
  | { kind: "replaced" }
  | { kind: "failed" };

/**
 * The payment form, and every way paying can go wrong.
 *
 * The card is only **held** when the customer pays; `createNewOrder` takes the money once the
 * order is written, and only if the hold is for what the cart costs (see ~/server/websiteOrder).
 * So a payment passes through three steps, each with its own failures:
 *
 * 1. **Before the card is touched** - the details, the cart repriced on the server (which also
 *    catches a price that changed since, and an item that sold out), the pick-up time, and the
 *    order parsed as the server will read it. Any problem stops here, and nothing has happened.
 * 2. **Holding the card** - declined, incomplete, failed 3D Secure, or Stripe unreachable.
 *    Nothing has been charged, and the same payment can be tried again.
 * 3. **Placing the order** - refused (the hold is let go, or the money handed back, and a new
 *    payment is started), or no answer at all, when pressing Pay again is safe.
 */
export default function CheckoutForm({
  customerInfo,
  router,
  cart,
  pickUpTime,
  setPickUpTime,
  pickUpNextOpening,
  clientSecret,
  paymentIntentId,
  pricedCart,
  onPriced,
  onPaymentReset,
  onOrderPlaced,
  onServerTime,
}: checkoutFormProps) {
  const { language } = useLanguage();
  const en = language === "en";
  const stripe = useStripe();
  const elements = useElements();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [warned, setWarned] = useState(false);
  const utils = api.useUtils();
  const { mutateAsync: checkPickUpTime } =
    api.store.checkPickUpTime.useMutation();
  const { mutateAsync: createOrder } = api.order.createNewOrder.useMutation({
    onSuccess: async () => {
      await utils.order.invalidate();
    },
  });

  // The cart the payment was last priced for. The cart can still be edited and emptied on this
  // page, which used to leave the customer paying the old total for the new cart; whenever the
  // cart on screen differs from this, the payment is repriced and Pay waits for it.
  const priced = pricedCart;
  const [repriceError, setRepriceError] = useState("");
  // A cart the server refused to price (an item sold out, say). Not retried until it changes.
  const [unsellableKey, setUnsellableKey] = useState<string | null>(null);
  // Bumped when a repricing ends, so a cart that changed while it ran is priced next.
  const [repriceRound, setRepriceRound] = useState(0);
  const repricing = useRef(false);
  // Set once an order is placed. Nothing reprices after that.
  const orderPlaced = useRef(false);

  const cartKey = checkoutCartKey(cart.cart);
  const inStep = cartKey === priced.key;
  const unsellable = cartKey === unsellableKey;

  // ---------------------------------------------------------------------------------------
  // Where a payment ends up
  // ---------------------------------------------------------------------------------------

  /**
   * Puts the customer's details on the payment as its Stripe customer, so the Stripe Dashboard
   * shows who paid. Only that label is at stake - the order records the customer either way -
   * so a failure is only logged, and `keepalive` lets it finish as the page moves on. It waits
   * for the order because Stripe takes a customer on a payment once it has succeeded, which a
   * held one has not.
   */
  const recordCustomerOnPayment = () => {
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
  };

  /**
   * The order is placed: record who paid, empty the cart and move on to the order. Every way
   * an order is reached comes through here - placed now, or found already placed by a retry.
   *
   * The cart is emptied here, before navigating, rather than as this page unmounts. If the
   * router cannot fetch the next page it falls back to a full page load, which runs no unmount
   * code at all, and the customer would arrive at their order with its items still in the cart.
   * The page is told first, so it shows the order as placed instead of "Your cart is empty".
   */
  const goToOrder = (orderId: string) => {
    orderPlaced.current = true;
    recordCustomerOnPayment();
    onOrderPlaced();
    cart.clearCart();
    router.push(`/order?orderId=${orderId}`);
  };

  /** A payment that is gone, for no reason worth more words: say so and start a new one. */
  const restartPayment = () => {
    toast({
      variant: "destructive",
      title: en ? "Please enter your card again" : "请重新输入您的银行卡信息",
      description: en
        ? "Your payment session ended, so we've started a new one. You haven't been charged."
        : "您的付款会话已结束，我们已为您重新开始。您没有被收费。",
    });
    onPaymentReset();
  };

  /**
   * A payment the server would not place an order with. Every reason but `not-paid` leaves it
   * unusable - released, refunded or expired - so a new one is started. The message goes in a
   * toast because starting a new payment remounts this form.
   */
  const handleRefusal = (refusal: OrderRefusal) => {
    switch (refusal.reason) {
      case "not-paid":
        setPaymentError(
          en
            ? "Your payment hasn't gone through. Please try again."
            : "您的付款尚未完成，请重试。",
        );
        return;

      case "pick-up-time":
        setPickUpTime(refusal.asap);
        toast({
          variant: "destructive",
          title: en ? "Your pick up time has changed!" : "您的取货时间已更改！",
          description: refusal.asap
            ? `${
                en
                  ? "We can't take a pick up at that time any more, so we haven't charged you. The soonest we can is"
                  : "该时间已无法取货，因此我们没有向您收费。最早可取货时间是"
              } ${formatNZ(refusal.asap, "EEE dd/MM/yyyy h:mm a")}`
            : en
              ? "We're not taking pick up orders at the moment, so we haven't charged you."
              : "我们目前不接受取货订单，因此没有向您收费。",
        });
        break;

      case "cart-changed":
        toast({
          variant: "destructive",
          title: en ? "Your total changed" : "您的总额已更改",
          description: en
            ? "Your cart or its prices changed after your card was approved, so we haven't charged you. Please check your total and pay again."
            : "您的银行卡获批后，购物车或价格发生了变化，因此我们没有向您收费。请核对总额后重新付款。",
        });
        break;

      case "cart-invalid":
        toast({
          variant: "destructive",
          title: en ? "We haven't charged you" : "我们没有向您收费",
          description: refusal.message,
        });
        break;

      case "expired":
        toast({
          variant: "destructive",
          title: en ? "Your payment expired" : "您的付款已过期",
          description: en
            ? "Your payment expired before your order was placed. You haven't been charged. Please pay again."
            : "您的付款在下单前已过期，您没有被收费。请重新付款。",
        });
        break;

      case "refunded":
        toast({
          variant: "destructive",
          title: en ? "Your payment was refunded" : "您的付款已退款",
          description: `${
            en ? "We've refunded" : "我们已退还"
          } ${formatCurrency(refusal.refundedInCents / 100)}${
            en
              ? ". Please check your cart and pay again."
              : "。请检查您的购物车后重新付款。"
          }`,
        });
        break;
    }

    onPaymentReset();
  };

  // ---------------------------------------------------------------------------------------
  // Keeping the payment in step with the cart
  // ---------------------------------------------------------------------------------------

  /**
   * Asks the server to price the payment for the cart with this key.
   *
   * A payment the card has already been confirmed on cannot be repriced - that happens only
   * after an order call for it failed - and the server settles it instead: a `409` carries the
   * order it paid for after all, or what became of it (released, refunded, expired).
   */
  const reprice = async (key: string): Promise<RepriceOutcome> => {
    let res: Response;
    let data: {
      totalInCents?: number;
      error?: string;
      orderId?: string;
      refusal?: OrderRefusal;
    };
    try {
      res = await fetch("/api/checkout_sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientSecret, items: JSON.parse(key) }),
      });
      data = (await res.json().catch(() => ({}))) as typeof data;
    } catch (error) {
      console.error(
        "Could not reach the server to reprice the payment:",
        error,
      );
      return { kind: "failed" };
    }

    if (res.status === 409) {
      // The order call that failed did place its order; only its answer was lost. What to
      // do with that is the caller's: pressing Pay finishes the order first, a cart edit
      // just goes to it.
      if (data.orderId)
        return { kind: "already-ordered", orderId: data.orderId };

      if (data.refusal && data.refusal.reason !== "not-paid") {
        handleRefusal(data.refusal);
      } else {
        restartPayment();
      }
      return { kind: "replaced" };
    }

    if (res.status === 404) {
      restartPayment();
      return { kind: "replaced" };
    }

    if (res.status === 400) {
      setUnsellableKey(key);
      setRepriceError(
        data.error ??
          (en
            ? "Something in your cart can't be ordered. Please check your cart."
            : "您购物车中的部分商品无法下单，请检查购物车。"),
      );
      return { kind: "unsellable" };
    }

    if (!res.ok || typeof data.totalInCents !== "number") {
      console.error(
        "The server could not reprice the payment:",
        res.status,
        data,
      );
      return { kind: "failed" };
    }

    // So the Payment Element - and a wallet's sheet - shows the new amount too. What is
    // confirmed is the server's amount either way, so a failure here is only logged.
    const updated = await elements?.fetchUpdates();
    if (updated?.error) {
      console.error(
        "The payment form did not pick up the new amount:",
        updated.error,
      );
    }

    setRepriceError("");
    onPriced({ key, amountInCents: data.totalInCents });
    return { kind: "priced", amountInCents: data.totalInCents };
  };

  // Read by the effect below when its timer fires, so it calls this render's functions
  // without re-running every render.
  const latestReprice = useRef(reprice);
  latestReprice.current = reprice;
  const goToOrderRef = useRef(goToOrder);
  goToOrderRef.current = goToOrder;

  useEffect(() => {
    if (inStep || unsellable || !elements || cart.cart.length === 0) return;
    // Pay has already sent the cart as it was when pressed, and the order is checked against
    // that. Repricing mid-payment could only swap the payment out from under it.
    if (repricing.current || paymentLoading || orderPlaced.current) return;

    const timer = setTimeout(() => {
      repricing.current = true;

      void latestReprice.current(cartKey).then((outcome) => {
        const next = () => {
          repricing.current = false;
          setRepriceRound((round) => round + 1);
        };

        if (outcome.kind === "already-ordered") {
          goToOrderRef.current(outcome.orderId);
          return next();
        }

        if (outcome.kind !== "failed") return next();

        setRepriceError(
          en
            ? "We couldn't update your total. Trying again..."
            : "无法更新您的总额，正在重试...",
        );
        setTimeout(next, REPRICE_RETRY_MS);
      });
    }, REPRICE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    cartKey,
    inStep,
    unsellable,
    repriceRound,
    elements,
    cart.cart.length,
    paymentLoading,
    en,
  ]);

  // ---------------------------------------------------------------------------------------
  // Paying
  // ---------------------------------------------------------------------------------------

  /** What is wrong with the customer's details, in their language, or null. */
  const detailsProblem = (): string | null => {
    if (
      !customerInfo.customerFirstName?.trim() ||
      !customerInfo.customerLastName?.trim() ||
      !customerInfo.customerEmail?.trim()
    ) {
      return en ? "Please fill in all your details." : "请填写您的所有信息。";
    }

    if (!parsePhoneNumberFromString(customerInfo.phone, "NZ")?.isValid()) {
      return en
        ? "Please enter a valid New Zealand phone number."
        : "请输入有效的新西兰电话号码。";
    }

    if (!pickUpTime) {
      return en ? "Please select a pick up time." : "请选择取货时间。";
    }

    return null;
  };

  /**
   * Holds the card for this payment. True once it is held - or was already, by an earlier
   * press of Pay whose order did not go through. False when it is not, with the reason shown.
   *
   * Stripe's own wording is written for the customer only for card errors (declined, expired,
   * wrong security code, insufficient funds) and validation errors (an incomplete card
   * number): those are shown as Stripe gives them. Anything else - a connection that dropped,
   * a request Stripe refused - is logged and shown in our own words, as Stripe advises.
   */
  const holdCard = async (
    stripe: Stripe,
    elements: StripeElements,
  ): Promise<boolean> => {
    const notCharged = en
      ? "We couldn't take your payment. You haven't been charged - please try again."
      : "无法处理您的付款，您没有被收费，请重试。";

    let result: PaymentIntentResult;
    try {
      result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
    } catch (error) {
      console.error("Could not confirm the payment with Stripe:", error);
      setPaymentError(notCharged);
      return false;
    }

    const { error, paymentIntent } = result;

    if (paymentIntent) {
      if (
        paymentIntent.status === "requires_capture" ||
        paymentIntent.status === "succeeded"
      ) {
        return true;
      }
      // Card payments come back held or with an error; anything else has not gone through.
      console.error("Stripe confirmed the payment as", paymentIntent.status);
      setPaymentError(notCharged);
      return false;
    }

    if (!error) {
      setPaymentError(notCharged);
      return false;
    }

    // Stripe will not confirm a payment twice. Pressing Pay again after an order call failed
    // finds the card already held (or, rarely, the money already taken), and the order is
    // placed against it. One whose hold has since been let go cannot be paid with again.
    if (error.code === "payment_intent_unexpected_state") {
      const status =
        error.payment_intent?.status ??
        (
          await stripe
            .retrievePaymentIntent(clientSecret)
            .catch(() => ({ paymentIntent: undefined }))
        ).paymentIntent?.status;

      if (status === "requires_capture" || status === "succeeded") return true;
      if (status === "canceled") {
        restartPayment();
        return false;
      }
    }

    if (error.type === "card_error" || error.type === "validation_error") {
      setPaymentError(error.message ?? notCharged);
      return false;
    }

    // 3D Secure that the customer failed or closed. Stripe types it as a request error, but
    // it is the customer's to act on.
    if (error.code === "payment_intent_authentication_failure") {
      setPaymentError(
        en
          ? "We couldn't verify your card with your bank. You haven't been charged - please try again or use a different card."
          : "无法通过您的银行验证此卡。您没有被收费，请重试或使用其他银行卡。",
      );
      return false;
    }

    console.error("Stripe could not confirm the payment:", error);
    setPaymentError(notCharged);
    return false;
  };

  /**
   * The order call itself failed - no answer, or an error rather than a refusal. The card is
   * held, not charged, until an order is placed.
   */
  const handleOrderCallFailure = (error: unknown) => {
    console.error("Could not place the order:", error);

    // Not a payment the server will place an order against - nothing to retry with.
    if (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") {
      restartPayment();
      return;
    }

    // No answer, or the server failed. The order may even have been placed with only its
    // answer lost - so no promise either way about the charge, only that trying again is
    // safe: the same payment finds the order already placed, or is captured once.
    setPaymentError(
      en
        ? "We couldn't confirm your order. Please press Pay again - you won't be charged twice."
        : "无法确认您的订单。请再次点击付款 - 您不会被重复收费。",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || paymentLoading || !inStep || unsellable) {
      return;
    }
    if (cart.cart.length === 0) return;

    setPaymentError("");

    // 1. Before the card is touched.
    const problem = detailsProblem();
    if (problem || !pickUpTime) {
      setPaymentError(problem ?? "");
      return;
    }

    const amountShown = priced.amountInCents;

    // Parsed with the server's own schema. The form's checks are looser in places - zod's
    // `email()` refuses addresses a simple pattern accepts - and an order the server cannot
    // read would otherwise hold the card on every press of Pay, for an order that could never
    // be placed.
    const parsedOrder = createOrderSchema.safeParse({
      desserts: cart.cart.map((item) => ({
        dessert: {
          id: item.dessert.id,
          quantity: item.quantity,
        },
        priceInCents: item.priceInCents,
        customisations: item.customisations,
        discountedAmountInCents: item.discountedAmountInCents,
        promoId: item.dessert.promo ? item.dessert.promo.id : null,
      })),
      customerFirstName: customerInfo.customerFirstName.trim(),
      customerLastName: customerInfo.customerLastName.trim(),
      customerEmail: customerInfo.customerEmail.trim(),
      customerPhoneNumber: customerInfo.phone,
      totalPriceInCents: amountShown,
      pickUpTime,
      clientSecret,
    });

    if (!parsedOrder.success) {
      console.error("The order would not be accepted:", parsedOrder.error);
      setPaymentError(
        parsedOrder.error.issues.some(
          (issue) => issue.path[0] === "customerEmail",
        )
          ? en
            ? "Please enter a valid email address."
            : "请输入有效的电子邮件地址。"
          : en
            ? "Something in your order couldn't be read. Please check your details and cart, then try again."
            : "无法读取您订单中的部分信息。请检查您的资料和购物车后重试。",
      );
      return;
    }

    // The last gates, both decided on the server and asked together:
    //
    // - The cart, repriced. Normally the payment is already in step with it, but a price can
    //   change and an item can sell out while the page sits open; either would otherwise be
    //   found only after the card was held. It also settles a payment an earlier press of Pay
    //   left confirmed, before it is confirmed again.
    // - The pick-up time, on the shop's hours and days off as they stand now. It is sent the
    //   payment rather than the cart's size: the server reads how many items that payment is
    //   for from what it recorded when pricing the cart. This used to be a check in the
    //   browser that swapped in a new time and then paid with the old one anyway; any change
    //   now stops here, so the customer sees the time they are paying for.
    setPaymentLoading(true);
    const [repriced, check] = await Promise.all([
      reprice(cartKey),
      paymentIntentId
        ? checkPickUpTime({ pickUpTime, paymentIntentId }).catch(() => null)
        : Promise.resolve(null),
    ]);
    setPaymentLoading(false);

    if (repriced.kind === "replaced") return;

    // The order this payment pays for was placed after all, by a call that lost its answer.
    // Placing it again writes nothing and hands back the same order, but it does finish what
    // that call may never have reached: the kitchen's announcement and the confirmation
    // email, both safe to repeat. A failure there is not the customer's to act on - their
    // order exists either way - so it is logged and the checkout goes to it regardless.
    if (repriced.kind === "already-ordered") {
      setPaymentLoading(true);
      await createOrder({ orderData: parsedOrder.data }).catch(
        (error: unknown) => {
          console.error(
            "Could not finish an order that was already placed:",
            error,
          );
        },
      );
      setPaymentLoading(false);
      goToOrder(repriced.orderId);
      return;
    }

    // Before anything else, so the picker's next ASAP is worked out on the server's clock and
    // agrees with any time about to be set.
    if (check) onServerTime(check.serverNow);

    if (repriced.kind === "unsellable") return;

    if (repriced.kind === "failed") {
      setPaymentError(
        en
          ? "We couldn't check your order. Please try again."
          : "无法核对您的订单，请重试。",
      );
      return;
    }

    if (repriced.amountInCents !== amountShown) {
      setPaymentError(
        en
          ? `Your total is now ${formatCurrency(repriced.amountInCents / 100)}. Please check your order and press Pay again.`
          : `您的总额现为 ${formatCurrency(repriced.amountInCents / 100)}。请核对订单后再次点击付款。`,
      );
      return;
    }

    if (!check) {
      setPaymentError(
        en
          ? "We couldn't confirm your pick up time. Please try again."
          : "无法确认您的取货时间，请重试。",
      );
      return;
    }

    if (!check.ok) {
      setPickUpTime(check.asap);
      if (check.asap) {
        toast({
          title: en ? "Your pick up time has changed!" : "您的取货时间已更改！",
          description:
            check.reason === "too-soon"
              ? `${
                  en
                    ? "The soonest we can have your order ready is"
                    : "我们最早可以准备好您订单的时间是"
                } ${formatNZ(check.asap, "EEE dd/MM/yyyy h:mm a")}`
              : `${
                  en
                    ? "We can't take a pick up at that time. The soonest we can is"
                    : "该时间无法取货。最早可取货时间是"
                } ${formatNZ(check.asap, "EEE dd/MM/yyyy h:mm a")}`,
          variant: "destructive",
        });
      } else {
        setPaymentError(
          en
            ? "We're not taking pick up orders at the moment."
            : "我们目前不接受取货订单。",
        );
      }
      return;
    }

    if (pickUpNextOpening && !warned) {
      toast({
        title: en
          ? "your pick up time is on another day!"
          : "看来您的取货时间是在其他天！",
        description: `${
          en
            ? "Please check your intended pick up date is at"
            : "请确认您预计的取货日期是"
        } ${formatNZ(pickUpTime, "EEE dd/MM/yyyy h:mm a")}`,
        variant: "destructive",
        duration: Infinity,
      });
      setWarned(true);
      return;
    }

    setPaymentLoading(true);
    try {
      // 2. Holding the card.
      if (!(await holdCard(stripe, elements))) return;

      // 3. Placing the order, which takes the money.
      let placed;
      try {
        placed = await createOrder({ orderData: parsedOrder.data });
      } catch (error) {
        handleOrderCallFailure(error);
        return;
      }

      if (!placed.ok) {
        handleRefusal(placed);
        return;
      }

      goToOrder(placed.orderId);
    } finally {
      setPaymentLoading(false);
    }
  };

  const updatingTotal = !inStep && !unsellable;
  const shownError =
    paymentError || (!inStep || unsellable ? repriceError : "");

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <PaymentElement />

          {shownError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
              {shownError}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              !stripe || !elements || paymentLoading || !inStep || unsellable
            }
          >
            {paymentLoading || updatingTotal ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {paymentLoading
                  ? en
                    ? "Processing..."
                    : "正在处理"
                  : en
                    ? "Updating total..."
                    : "正在更新总额"}
              </>
            ) : (
              `${en ? "Pay " : "支付 "}${formatCurrency(priced.amountInCents / 100)}`
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
