"use client";

import type React from "react";

import { useContext, useEffect, useState } from "react";
import { CartContext } from "~/app/components/cartContext";
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "~/components/ui/button";
import { Loader2, ShoppingBag, CheckCircle, AlertCircle } from "lucide-react";
import { formatCurrency } from "~/lib/formatters";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";

type CustomerInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export default function CheckoutPage() {
  const cart = useContext(CartContext);
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!cart?.totalPrice || !isClient) return;

    setIsLoading(true);
    fetch("/api/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: cart?.totalPrice }),
    })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        setIsLoading(false);
      })
      .catch((error) => {
        setError("Failed to initialize payment. Please try again.");
        setIsLoading(false);
      });
  }, [cart?.totalPrice, isClient]);

  const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
  );

  const handleCustomerInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomerInfo((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Show loading state during server rendering and initial client render
  if (!isClient) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cart?.cart || cart.cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShoppingBag className="mb-4 h-16 w-16 text-gray-300" />
        <h2 className="mb-2 text-2xl font-medium">Your cart is empty</h2>
        <p className="mb-8 text-center text-gray-500">
          You don't have any items in your cart yet.
        </p>
        <Link href="/menu">
          <Button>Browse Menu</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 text-center text-3xl font-bold">Checkout</h1>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.cart.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="relative mt-2 h-16 w-16 flex-shrink-0 self-start overflow-hidden rounded-md border border-gray-200">
                    {item.dessert.imagePath ? (
                      <Image
                        src={item.dessert.imagePath || "/placeholder.svg"}
                        alt={item.dessert.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100">
                        <ShoppingBag className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <h3 className="font-medium">{item.dessert.name}</h3>
                    {item.customisations?.map((customisation) => (
                      <p
                        className="ml-1 mt-1 items-center text-sm text-gray-500"
                        key={customisation.id}
                      >
                        {customisation.quantity > 1
                          ? `+${customisation.quantity} ${customisation.name}`
                          : customisation.quantity === 1
                            ? `+${customisation.name}`
                            : `-${customisation.name}`}
                      </p>
                    ))}
                    <p className="mt-1 text-sm font-semibold text-gray-500">
                      Quantity: {item.quantity}
                    </p>
                  </div>
                  <div className="self-start text-right">
                    <p className="font-medium">
                      {formatCurrency(item.priceInCents / 100)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(
                        (item.priceInCents / 100) * item.quantity,
                      )}
                    </p>
                  </div>
                </div>
              ))}

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>GST included</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(cart.totalPrice / 100 || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={customerInfo.firstName}
                    onChange={handleCustomerInfoChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={customerInfo.lastName}
                    onChange={handleCustomerInfoChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={customerInfo.email}
                    onChange={handleCustomerInfoChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={customerInfo.phone}
                    onChange={handleCustomerInfoChange}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Section */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              {clientSecret && (
                <Elements options={{ clientSecret }} stripe={stripePromise}>
                  <CheckoutForm
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
                By completing your purchase, you agree to our Terms of Service
                and Privacy Policy.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CheckoutForm({
  totalPriceInCents,
  customerInfo,
  router,
}: {
  totalPriceInCents: number;
  customerInfo: CustomerInfo;
  router: any;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const cart = useContext(CartContext);
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
