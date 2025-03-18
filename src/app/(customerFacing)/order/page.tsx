"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import {
  formatCurrency,
  formatDate,
  getCollectionTime,
} from "~/lib/formatters";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import {
  Clock,
  Calendar,
  User,
  Mail,
  Phone,
  ShoppingBag,
  Printer,
  ArrowLeft,
  CheckCircle,
  Loader2,
} from "lucide-react";

export default function OrderPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    data: order,
    isLoading,
    error,
  } = api.order.getOrder.useQuery(
    { id: orderId ?? "" },
    { enabled: !!orderId && isClient },
  );

  const twentyFourHours = 24 * 60 * 60 * 1000;

  //If no order id or order is picked up and its been 24 hours already then redirect user back to home page
  if (
    (order?.status === "PICKED_UP" &&
      new Date().getTime() - new Date(order.createdAt).getTime() >
        twentyFourHours) ||
    !orderId
  ) {
    router.push("/");
  }

  // Format date for display

  // Handle printing the receipt
  const handlePrint = () => {
    window.print();
  };

  if (!isClient) {
    return (
      <div className="flex justify-center py-[15%]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-[15%]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-red-500">
              Order Not Found
            </CardTitle>
            <CardDescription className="text-center">
              We couldn't find the order you're looking for. Please check the
              order ID and try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 print:py-2">
      {/* Order Status Banner */}
      <div className="mb-8 rounded-lg bg-green-50 p-4 text-center print:hidden">
        <div className="flex items-center justify-center">
          <CheckCircle className="mr-2 h-6 w-6 text-green-500" />
          <h2 className="text-xl font-semibold text-green-700">
            Order Confirmed
          </h2>
        </div>
        <p className="mt-1 text-green-600">
          Your order has been received and is being prepared.
        </p>
      </div>

      {/* Order Details Card */}
      <Card className="mb-8 overflow-hidden border-2 border-primary/10 print:border-none">
        <div className="bg-primary/5 print:bg-transparent">
          <CardHeader>
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div>
                <CardTitle className="text-2xl">
                  Order #{order.tempOrderId}
                </CardTitle>
                <CardDescription className="mt-1 flex items-center">
                  <Calendar className="mr-1 h-4 w-4" />
                  {formatDate(order.createdAt.toISOString())}
                </CardDescription>
              </div>
              <div className="print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Receipt
                </Button>
              </div>
            </div>
          </CardHeader>
        </div>

        <CardContent className="p-6">
          {/* Collection Information */}
          <div className="mb-6 rounded-lg bg-amber-50 p-4 print:border print:border-dashed print:border-amber-300 print:bg-transparent">
            <h3 className="flex items-center text-lg font-semibold text-amber-800">
              <Clock className="mr-2 h-5 w-5" />
              Collection Information
            </h3>
            <p className="mt-2 text-amber-700">
              Your order will be ready for collection at{" "}
              <span className="font-bold">
                {getCollectionTime(order.createdAt.toISOString())}
              </span>
            </p>
            <p className="mt-1 text-sm text-amber-600">
              Please have your order number ready when you arrive.
            </p>
          </div>

          {/* Customer Details */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold">Customer Details</h3>
            <div className="grid gap-2">
              <div className="flex items-center">
                <User className="mr-2 h-4 w-4 text-gray-500" />
                <span>
                  {order.customerFirstName} {order.customerLastName}
                </span>
              </div>
              <div className="flex items-center">
                <Mail className="mr-2 h-4 w-4 text-gray-500" />
                <span>{order.customerEmail}</span>
              </div>
              <div className="flex items-center">
                <Phone className="mr-2 h-4 w-4 text-gray-500" />
                <span>{order.customerPhoneNumber}</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Order Items */}
          <div>
            <h3 className="mb-4 flex items-center text-lg font-semibold">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Order Items
            </h3>

            <div className="space-y-4">
              {order.desserts.map((item) => {
                const pricePerItem =
                  (item.dessert.priceInCents +
                    item.customisations.reduce((total, customisation) => {
                      return (
                        total +
                        customisation.customisation.priceInCents *
                          customisation.quantity
                      );
                    }, 0)) /
                  100;
                return (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative h-16 w-16 flex-shrink-0 self-start overflow-hidden rounded-md border border-gray-200">
                      {item.dessert.imagePath ? (
                        <Image
                          src={item.dessert.imagePath ?? "/placeholder.svg"}
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
                      <h4 className="font-medium">{item.dessert.name}</h4>
                      {item.customisations?.map((customisation) => (
                        <p
                          className="ml-1 mt-1 text-sm text-gray-500"
                          key={customisation.id}
                        >
                          {customisation.quantity > 1
                            ? `+${customisation.quantity} ${customisation.customisation.name}`
                            : customisation.quantity === 1
                              ? `+${customisation.customisation.name}`
                              : `-${customisation.customisation.name}`}
                        </p>
                      ))}
                      <p className="text-sm text-gray-500">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <div className="self-start text-right">
                      <p className="font-medium">
                        {formatCurrency(pricePerItem)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(pricePerItem * item.quantity)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator className="my-4" />

            {/* Order Summary */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span>GST included</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatCurrency(order.priceInCents / 100)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between print:hidden">
        <Link href="/menu">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Menu
          </Button>
        </Link>
        <div className="flex gap-4">
          <Link href="/contact">
            <Button variant="outline">Need Help?</Button>
          </Link>
          <Link href="/">
            <Button>Return to Home</Button>
          </Link>
        </div>
      </div>

      {/* Print-only footer */}
      <div className="mt-8 hidden text-center text-sm text-gray-500 print:block">
        <p>Thank you for your order!</p>
        <p className="mt-1">
          For any questions, please contact us at support@eversweet.com
        </p>
      </div>
    </div>
  );
}
