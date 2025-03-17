"use client";

import { CartContextType } from "~/app/components/cartContext";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { formatCurrency } from "~/lib/formatters";
import { Separator } from "~/components/ui/separator";

type orderSummaryProps = {
  cart: CartContextType;
};

export default function OrderSummary({ cart }: orderSummaryProps) {
  return (
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
                {formatCurrency((item.priceInCents / 100) * item.quantity)}
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
  );
}
