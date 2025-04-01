"use client";

import { Suspense, useEffect, useState } from "react";
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
import { useLanguage } from "~/app/components/language";

function OrderDetails() {
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const {
    data: order,
    isLoading,
    error,
  } = api.order.getOrder.useQuery(
    { id: orderId ?? "" },
    { enabled: !!orderId && isClient },
  );
  const twentyFourHours = 24 * 60 * 60 * 1000;

  useEffect(() => {
    setIsClient(true);
    //If no order id or order is picked up and its been 24 hours already then redirect user back to home page
    if (!orderId) {
      router.push("/");
    }
  }, []);

  // Handle printing the receipt

  if (!isClient) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  if (order?.status === "PICKED_UP") {
    return (
      <div className="fixed inset-0 mx-auto flex max-w-3xl items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-red-500">
              {language === "en" ? "Order picked up" : "订单已取"}
            </CardTitle>
            <CardDescription className="text-center">
              {language === "en"
                ? "Seems like your order has already been picked up. Thank you for your order!"
                : "看起来您的订单已经被取走了。谢谢您的订购!"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {language === "en" ? "Return to Home" : "返回首页"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (
    error ||
    !order ||
    new Date().getTime() - new Date(order.createdAt).getTime() > twentyFourHours
  ) {
    return (
      <div className="fixed inset-0 mx-auto flex max-w-3xl items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-red-500">
              {language === "en" ? "Order Not Found" : "未找到订单"}
            </CardTitle>
            <CardDescription className="text-center">
              {language === "en"
                ? "Looks like your order has expired or does not exist. Please check the order ID and try again."
                : "我们找不到您要查找的订单。请检查订单 ID 并重试。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {language === "en" ? "Return to Home" : "返回首页"}
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
            {language === "en" ? "Order Confirmed" : "订单已确认"}
          </h2>
        </div>
        <p className="mt-1 text-green-600">
          {language === "en"
            ? "Your order has been received and is being prepared."
            : "您的订单已收到并正在准备中。"}
        </p>
      </div>

      {/* Order Details Card */}
      <Card className="mb-8 overflow-hidden border-2 border-primary/10 print:border-none">
        <div className="bg-primary/5 print:bg-transparent">
          <CardHeader>
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div>
                <CardTitle className="text-2xl">
                  {language === "en" ? "Order " : "单号 "} #{order.tempOrderId}
                </CardTitle>
                <CardDescription className="mt-1 flex items-center">
                  <Calendar className="mr-1 h-4 w-4" />
                  {formatDate(order.createdAt.toISOString())}
                </CardDescription>
              </div>
              <div className="print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  {language === "en" ? "Print Receipt" : "打印收据"}
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
              {language === "en" ? "Collection Information" : "取时间"}
            </h3>
            <p className="mt-2 text-amber-700">
              {language === "en"
                ? "Your order will be ready for collection at "
                : "您的订单将在以下时间准备好 "}
              <span className="font-bold">
                {getCollectionTime(order.pickUpTime)}
              </span>
            </p>
            <p className="mt-1 text-sm text-amber-600">
              {language === "en"
                ? "Please have your order number ready when you arrive."
                : "来取的时候，请准备好您的订单号"}
            </p>
          </div>

          {/* Customer Details */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold">
              {language === "en" ? "Customer Details" : "客户详情"}
            </h3>
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
              {language === "en" ? "Order Items" : "订购商品"}
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
                          src={item.dessert.imagePath}
                          alt={
                            language === "en"
                              ? item.dessert.name
                              : item.dessert.chineseName
                          }
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
                      <h4 className="font-medium">
                        {language === "en"
                          ? item.dessert.name
                          : item.dessert.chineseName}
                      </h4>
                      {item.customisations?.map((customisation) => {
                        const customisationName =
                          language === "en"
                            ? customisation.customisation.name
                            : customisation.customisation.chineseName;
                        return (
                          <p
                            className="ml-1 mt-1 text-sm text-gray-500"
                            key={customisation.id}
                          >
                            {customisation.quantity > 1
                              ? `+${customisation.quantity} ${customisationName}`
                              : customisation.quantity === 1
                                ? `+${customisationName}`
                                : `-${customisationName}`}
                          </p>
                        );
                      })}
                      <p className="text-sm text-gray-500">
                        {language === "en" ? "Quantity: " : "数量: "}
                        {item.quantity}
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
                <span>{language === "en" ? "GST included" : "包含消费税"}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>{language === "en" ? "Total" : "总计"}</span>
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
            {language === "en" ? "Back to Menu" : "返回菜单"}
          </Button>
        </Link>
        <div className="flex gap-4">
          <Link href="/contact">
            <Button variant="outline">
              {language === "en" ? "Need Help?" : "需要帮助吗"}
            </Button>
          </Link>
          <Link href="/">
            <Button>{language === "en" ? "Return to Home" : "返回首页"}</Button>
          </Link>
        </div>
      </div>

      {/* Print-only footer */}
      <div className="mt-8 hidden text-center text-sm text-gray-500 print:block">
        <p>
          {language === "en" ? "Thank you for your order!" : "感谢您的订购"}
        </p>
        <p className="mt-1">
          {language === "en"
            ? "For any questions, please contact us at eversweet@eversweet.com"
            : "如有任何疑问，请联系我们: eversweet@eversweet.com"}
        </p>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <OrderDetails />
    </Suspense>
  );
}
