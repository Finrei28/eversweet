"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import ProductDialogContext from "./productDialogContext";
import { formatCurrency } from "~/lib/formatters";
import Image from "next/image";
import { api } from "~/trpc/react";

export function ProductCards() {
  const [products] = api.dessert.getProducts.useSuspenseQuery();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {products.map((dessert) => (
        <div
          key={dessert.id}
          className="relative flex h-[28rem] flex-col overflow-hidden rounded-lg bg-white shadow-lg"
        >
          <div className="relative h-40 w-full">
            {dessert.imagePath ? (
              <Image
                src={dessert.imagePath || "/placeholder.svg"}
                alt={dessert.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="h-full w-full bg-gray-200" />
            )}
          </div>
          <div className="flex flex-1 flex-col p-6">
            <h2 className="mb-4 line-clamp-2 text-center text-lg font-bold text-gray-700 md:text-2xl">
              {dessert.name} ({dessert.chineseName})
            </h2>
            <div className="mt-2 flex flex-col space-y-2 text-sm md:text-base">
              <p>
                <span>{formatCurrency(dessert.priceInCents / 100)}</span>
              </p>
              {dessert.description && (
                <div>
                  <p className="font-medium">Description:</p>
                  <p className="line-clamp-2 text-gray-400">
                    {dessert.description}
                  </p>
                </div>
              )}

              <div>
                <p className="font-medium">Ingredients:</p>
                <p className="line-clamp-2 text-gray-400">
                  {dessert.ingredients.join(", ")}
                </p>
              </div>
              {dessert.isAvailableForPurchase ? (
                <div className="mt-1 flex items-center gap-2 text-green-500">
                  <CheckCircle2 />
                  <span>Available</span>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2 text-red-500">
                  <XCircle />
                  <span>Unavailable</span>
                </div>
              )}
            </div>
            <div className="mt-auto flex w-full flex-col justify-center pt-4">
              <ProductDialogContext product={dessert} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
