"use client";

import { CartContextType } from "~/app/components/cartContext";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import Image from "next/image";
import { ShoppingBag, Trash2 } from "lucide-react";
import { formatCurrency } from "~/lib/formatters";
import { Separator } from "~/components/ui/separator";
import { useLanguage } from "~/app/components/language";
import CustomisationDialog from "../../menu/_components/customisation";
import { Button } from "~/components/ui/button";
import { PickupTimePicker } from "./pick-up-time";
import { format } from "date-fns";

type orderSummaryProps = {
  cart: CartContextType;
  pickUpTime: Date | null;
  setPickUpTime: React.Dispatch<React.SetStateAction<Date | null>>;
  setPickUpNextOpening: (boolean: boolean) => void;
  pickUpNextOpening: boolean;
};

export default function OrderSummary({
  cart,
  pickUpTime,
  setPickUpTime,
  setPickUpNextOpening,
  pickUpNextOpening,
}: orderSummaryProps) {
  const { language } = useLanguage();

  // Custom business hours example

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {language === "en" ? "Order Summary" : "订单摘要"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PickupTimePicker
            value={pickUpTime}
            onChange={setPickUpTime}
            setPickUpNextOpening={setPickUpNextOpening}
            pickUpNextOpening={pickUpNextOpening}
          />

          {pickUpTime && (
            <div className="rounded-md bg-muted p-3">
              <p className="font-medium">
                {language === "en" ? "Selected Pickup Time:" : "选定取货时间:"}
              </p>
              <p>{format(pickUpTime, "dd/MM/yyyy h:mm a")}</p>
            </div>
          )}
          {/* <DateTimePicker
            pickUpTime={pickUpTime}
            setPickUpTime={setPickUpTime}
            getNextValidTime={getNextValidTime}
            setASAP={setASAP}
            ASAP={ASAP}
          /> */}
          {cart.cart.map((item) => {
            const editButton = (
              <CustomisationDialog dessert={item.dessert} cartItem={item} />
            );
            const deleteButton = (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => cart.removeAllSameItemFromCart(item.id)}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            );
            return (
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
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
                        ? customisation.name
                        : customisation.chineseName;
                    return (
                      <p
                        className="ml-1 mt-1 items-center text-xs text-gray-500 md:text-base"
                        key={customisation.id}
                      >
                        {customisation.quantity > 1
                          ? `+ ${customisation.quantity} ${customisationName}`
                          : customisation.quantity === 1
                            ? `+ ${customisationName}`
                            : `- ${customisationName}`}
                      </p>
                    );
                  })}
                  <p className="mt-1 text-xs font-semibold text-gray-500 md:text-base">
                    {language === "en" ? "Quantity:" : "数量:"}
                    {item.quantity}
                  </p>
                </div>
                <div className="hidden w-auto min-w-[6%] md:flex">
                  {editButton} {deleteButton}
                </div>

                <div className="flex w-auto min-w-[6%] flex-col text-right md:text-right">
                  {/* Price Section */}

                  <p className="font-medium">
                    {formatCurrency(item.priceInCents / 100)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency((item.priceInCents / 100) * item.quantity)}
                  </p>

                  {/* Edit Button */}
                  <div className="flex items-center justify-end md:hidden">
                    <div className="text-center">{editButton}</div>
                    <div>{deleteButton}</div>
                  </div>
                </div>
              </div>
            );
          })}

          <Separator className="my-4" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{language === "en" ? "GST included" : "包含消费税"}</span>
              <span>{formatCurrency((cart.totalPrice * 0.15) / 100 || 0)}</span>
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
