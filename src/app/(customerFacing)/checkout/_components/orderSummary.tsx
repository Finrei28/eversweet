"use client";

import { CartContextType } from "~/app/components/cartContext";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { formatCurrency } from "~/lib/formatters";
import { Separator } from "~/components/ui/separator";
import { useLanguage } from "~/app/components/language";
import CustomisationDialog from "../../menu/_components/customisation";

import { DateTimePicker } from "./dateTimePicker";

type orderSummaryProps = {
  cart: CartContextType;
  pickUpTime: Date;
  setPickUpTime: React.Dispatch<React.SetStateAction<Date>>;
  getNextValidTime: () => Date;
};

export default function OrderSummary({
  cart,
  pickUpTime,
  setPickUpTime,
  getNextValidTime,
}: orderSummaryProps) {
  const { language } = useLanguage();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {language === "en" ? "Order Summary" : "订单摘要"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateTimePicker
            pickUpTime={pickUpTime}
            setPickUpTime={setPickUpTime}
            getNextValidTime={getNextValidTime}
          />
          {cart.cart.map((item) => (
            <div key={item.id} className="flex gap-4">
              <div className="relative mt-2 h-16 w-16 flex-shrink-0 self-start overflow-hidden rounded-md border border-gray-200">
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
                <h3 className="font-medium">
                  {language === "en"
                    ? item.dessert.name
                    : item.dessert.chineseName}
                </h3>
                {item.customisations?.map((customisation) => {
                  const customisationName =
                    language === "en"
                      ? customisation.name
                      : customisation.chineseName;
                  return (
                    <p
                      className="ml-1 mt-1 items-center text-sm text-gray-500"
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
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  {language === "en" ? "Quantity:" : "数量:"}
                  {item.quantity}
                </p>
              </div>

              <CustomisationDialog dessert={item.dessert} cartItem={item} />

              <div className="flex w-auto min-w-[6%] flex-col text-right">
                <p className="font-medium">
                  {formatCurrency(item.priceInCents / 100)}
                </p>
                <p className="text-sm text-gray-500">
                  {formatCurrency((item.priceInCents / 100) * item.quantity)}
                </p>
              </div>
            </div>
          ))}

          <Separator className="my-4" />

          <div className="space-y-2">
            <div className="flex justify-between">
              <span>{language === "en" ? "GST included" : "包含消费税"}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-bold">
              <span>{language === "en" ? "Total" : "总计"}</span>
              <span>{formatCurrency(cart.totalPrice / 100 || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
