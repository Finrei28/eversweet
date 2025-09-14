"use client";

import { CheckCircle2, Loader2, Soup, XCircle } from "lucide-react";
import ProductDialogContext from "./productDialogContext";
import { formatCurrency } from "~/lib/formatters";
import Image from "next/image";
import { api } from "~/trpc/react";
import { EditCustomisation } from "./customisations/Customisation";
import { useLanguage } from "~/app/components/language";

export function ProductCards() {
  const { language } = useLanguage();
  const { data: productCategory, isLoading: isProductLoading } =
    api.dessert.getProductsForAdminByCategory.useQuery();
  const [customisations] =
    api.productCustomisation.dessertCustomisations.useSuspenseQuery();

  if (isProductLoading) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium text-primary">
            {language === "en"
              ? "Loading our delicious menu..."
              : "正在加载我们美味的菜单..."}
          </p>
        </div>
      </div>
    );
  }

  if (!productCategory || productCategory.length === 0) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 rounded-lg bg-muted/30 p-8 text-center">
        <Soup className="h-16 w-16 text-muted" />
        <p className="text-xl font-medium">
          {language === "en"
            ? "Sorry, we currently have no desserts available"
            : "抱歉，我们目前没有甜点出售"}
        </p>
        <p className="text-muted-foreground">
          {language === "en"
            ? "Start adding some products to the menu"
            : "开始在菜单中添加一些产品吧！"}
        </p>
      </div>
    );
  }

  const categoriesWithDesserts = productCategory.filter(
    (category) => category.desserts.length > 0,
  );
  return (
    <>
      {/* Edit and add buttons */}
      <div className="mb-10 flex justify-end gap-6">
        <EditCustomisation />
        <ProductDialogContext />
      </div>
      {/* Product cards */}
      <div className="mb-20 space-y-16">
        {categoriesWithDesserts.map((category) => (
          <div key={category.id}>
            <div className="mb-6 flex items-center">
              <div className="h-px flex-grow bg-primary/20"></div>
              <h2 className="mx-4 text-2xl font-bold text-primary underline md:text-3xl">
                {language === "en" ? category.name : category.chineseName}
              </h2>
              <div className="h-px flex-grow bg-primary/20"></div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 md:px-2 lg:grid-cols-4">
              {category.desserts.map((dessert) => (
                <div
                  key={dessert.id}
                  className="relative flex flex-col overflow-hidden rounded-lg bg-white shadow-lg"
                >
                  <div className="relative h-40 w-full">
                    {dessert.imagePath ? (
                      <Image
                        src={dessert.imagePath}
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
                      {language === "en" ? dessert.name : dessert.chineseName}
                    </h2>
                    <div className="mt-2 flex flex-col space-y-2 text-sm md:text-base">
                      <p>
                        <span>
                          {formatCurrency(dessert.priceInCents / 100)}
                        </span>
                      </p>
                      {dessert.description && (
                        <div>
                          <p className="font-medium">
                            {language === "en" ? "Description:" : "描述:"}
                          </p>
                          <p className="line-clamp-2 text-gray-400">
                            {dessert.description}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="font-medium">
                          {language === "en" ? "Ingredients:" : "原料:"}
                        </p>
                        <p className="line-clamp-2 text-gray-400">
                          {language === "en"
                            ? dessert.ingredients.join(" • ")
                            : dessert.ingredients
                                .map((ingredient) => {
                                  const match = customisations?.find(
                                    (c) => c.name === ingredient,
                                  );
                                  return match?.chineseName || ingredient;
                                })
                                .join(" • ")}
                        </p>
                      </div>
                      {dessert.isAvailableForPurchase ? (
                        <div className="mt-1 flex items-center gap-2 text-green-500">
                          <CheckCircle2 />
                          <span>{language === "en" ? "Available" : "有"}</span>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-2 text-red-500">
                          <XCircle />
                          <span>
                            {language === "en" ? "Unavailable" : "卖完"}
                          </span>
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
          </div>
        ))}
      </div>
    </>
  );
}
