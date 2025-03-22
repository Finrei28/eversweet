"use client";

import { Minus, Plus, Info, SquarePen } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { formatCurrency } from "~/lib/formatters";
import { api } from "~/trpc/react";
import { nanoid } from "nanoid";
import { CartContext, CartItem } from "~/app/components/cartContext";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useLanguage } from "~/app/components/language";
import { usePathname } from "next/navigation";
import { dessertOnClient } from "~/app/components/types";

type CustomisationDialogProps = {
  dessert: dessertOnClient;
  homePageOpen?: boolean;
  setHomePageOpen?: (open: boolean) => void;
  onClose?: () => void;
  cartItem?: CartItem;
};

export default function CustomisationDialog({
  dessert,
  homePageOpen,
  setHomePageOpen,
  onClose,
  cartItem,
}: CustomisationDialogProps) {
  const [customisations] =
    api.productCustomisation.availableDessertCustomisations.useSuspenseQuery();
  const { language } = useLanguage();
  const [totalQuantity, setTotalQuantity] = useState(
    customisations.map((customisation) => ({
      id: customisation.id,
      name: customisation.name,
      chineseName: customisation.chineseName,
      quantity: dessert.ingredients.includes(customisation.name) ? 1 : 0,
    })),
  );

  const [modifications, setModifications] = useState<typeof totalQuantity>(
    cartItem ? cartItem.customisations : [],
  );
  const [totalPrice, setTotalPrice] = useState(
    cartItem ? cartItem.priceInCents : dessert.priceInCents,
  );
  const [dessertQuantity, setDessertQuantity] = useState(
    cartItem ? cartItem.quantity : 1,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const cart = useContext(CartContext);
  const pathName = usePathname();

  useEffect(() => {
    if (!dessert) return;
    const totalPrice = modifications.reduce((acc, item) => {
      // Find the customisation with the same ID
      const customisation = customisations.find(
        (custom) => custom.id === item.id,
      );

      // If customisation is found, calculate the price
      if (customisation) {
        acc += customisation.priceInCents * item.quantity;
      }

      return acc;
    }, 0);
    setTotalPrice(totalPrice + dessert.priceInCents);
  }, [totalQuantity, modifications, customisations, dessert, dessertQuantity]);

  // function for button to increase quantity associated with each customisation
  const handleIncrease = (id: string, name: string, chineseName: string) => {
    const getCustomisationQuantity = totalQuantity.find(
      (quantity) => quantity.id === id,
    );
    if (getCustomisationQuantity && getCustomisationQuantity.quantity >= 1) {
      setModifications((prev) => {
        const exists = prev.some((item) => item.id === id);
        return exists
          ? prev.map((item) =>
              item.id === id && item.quantity < 5
                ? { ...item, quantity: item.quantity + 1 }
                : item,
            )
          : [...prev, { id, name, chineseName, quantity: 1 }]; // Initialize if missing
      });
    } else if (
      getCustomisationQuantity &&
      getCustomisationQuantity.quantity === 0
    ) {
      setModifications((prev) => {
        const customisationNotInDessert = !dessert.ingredients.includes(name);
        const exists = prev.some((item) => item.id === id);
        if (customisationNotInDessert) {
          return [...prev, { id, name, chineseName, quantity: 1 }];
        }
        return exists
          ? prev.filter((item) => item.id !== id) // Remove the modification with the matching id
          : prev;
        // No need to change if item is not in modifications
      });
    }

    setTotalQuantity((prev) =>
      prev.map((item) =>
        item.id === id && item.quantity < 5
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      ),
    );
  };
  // function for button to decrease quantity associated with each customisation
  const handleDecrease = (id: string, name: string, chineseName: string) => {
    const getCustomisationQuantity = totalQuantity.find(
      (quantity) => quantity.id === id,
    );
    const customisationNotInDessert = !dessert.ingredients.includes(name);

    if (customisationNotInDessert) {
      setModifications((prev) => {
        const exists = prev.some((item) => item.id === id && item.quantity > 1);
        return exists
          ? prev.map((item) =>
              item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
            )
          : prev.filter((item) => item.id !== id);
      });
    } else if (
      getCustomisationQuantity &&
      getCustomisationQuantity.quantity > 2
    ) {
      setModifications((prev) => {
        const exists = prev.some((item) => item.id === id);
        return exists
          ? prev.map((item) =>
              item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
            )
          : prev;
      });
    } else if (
      getCustomisationQuantity &&
      getCustomisationQuantity.quantity === 1
    ) {
      setModifications((prev) => {
        return [...prev, { id, name, chineseName, quantity: 0 }];
      });
    } else if (
      getCustomisationQuantity &&
      getCustomisationQuantity.quantity === 2
    ) {
      setModifications((prev) => {
        const exists = prev.some((item) => item.id === id);
        return exists
          ? prev.filter((item) => item.id !== id) // Remove the modification with the matching id
          : prev; // No need to change if item is not in modifications
      });
    }

    setTotalQuantity((prev) =>
      prev.map((item) =>
        item.id === id && item.quantity > 0
          ? { ...item, quantity: item.quantity - 1 }
          : item,
      ),
    );
  };

  const handleClose = () => {
    if (setHomePageOpen) {
      setHomePageOpen(false);
    } else if (!dialogOpen) {
      setDialogOpen(true);
    } else {
      setDialogOpen(false);
    }
    onClose?.();
    setTotalQuantity(
      customisations.map((customisation) => {
        const previousQuantity = cartItem?.customisations.find(
          (c) => c.id === customisation.id,
        )?.quantity;
        const customisationIncluded = dessert.ingredients.includes(
          customisation.name,
        );

        return {
          id: customisation.id,
          name: customisation.name,
          chineseName: customisation.chineseName,
          quantity:
            previousQuantity && !customisationIncluded
              ? previousQuantity
              : previousQuantity && customisationIncluded
                ? previousQuantity + 1
                : dessert.ingredients.includes(customisation.name)
                  ? 1
                  : 0,
        };
      }),
    );
    setModifications(cartItem?.customisations ?? []);
    setDessertQuantity(cartItem?.quantity ?? 1);
  };

  const handleAddDessertToCart = () => {
    const item = {
      id: nanoid(),
      customisations: modifications,
      dessert,
      priceInCents: totalPrice,
      quantity: dessertQuantity,
    };

    if (!cart) return null;
    cart.addToCart(item);
    handleClose();
    return;
  };

  const handleEditDessertToCart = () => {
    if (!cart || !cartItem) return;
    const item = {
      id: cartItem.id,
      customisations: modifications,
      dessert,
      priceInCents: totalPrice,
      quantity: dessertQuantity,
    };

    cart.updateItemFromCart(cartItem.id, item);
    handleClose();
    return;
  };

  // Group customizations by included vs additional
  const includedCustomisations = customisations.filter((c) =>
    dessert.ingredients.includes(c.name),
  );

  const additionalCustomisations = customisations.filter(
    (c) => !dessert.ingredients.includes(c.name),
  );

  return (
    <Dialog
      open={homePageOpen ? homePageOpen : dialogOpen}
      onOpenChange={handleClose}
    >
      {!homePageOpen && (
        <DialogTrigger asChild>
          <Button
            variant={`${pathName === "/checkout" ? "ghost" : "default"}`}
            className={`${pathName === "/checkout" ? "" : "w-full"}`}
          >
            {pathName === "/checkout" ? (
              <SquarePen className="mt-1 h-5 w-5 hover:cursor-pointer" />
            ) : (
              `${language === "en" ? "Customise goodie" : "定制"}`
            )}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="h-[95%] sm:max-w-[425px] md:h-auto">
        <DialogHeader className="md:pb-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="mb-1 text-xl text-primary">
                {language === "en" ? dessert.name : dessert.chineseName}
              </DialogTitle>
              <DialogDescription className="text-start">
                {dessert.description}
              </DialogDescription>
            </div>

            {dessert.imagePath && (
              <div className="relative ml-4 mr-4 mt-2 h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
                <Image
                  src={dessert.imagePath}
                  alt={language === "en" ? dessert.name : dessert.chineseName}
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex items-center">
            <Badge variant="outline" className="mr-2 bg-primary/10">
              {formatCurrency(dessert.priceInCents / 100)}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full p-0"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {language === "en"
                      ? "Customize your dessert below"
                      : "在下面定制您的甜点"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogHeader>

        <Separator className="my-2" />

        <div className="max-h-[40vh] overflow-y-auto px-1 py-2">
          {includedCustomisations.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 font-medium text-primary">
                {language === "en" ? "Included Ingredients" : "包含成分"}
              </h3>
              <div className="space-y-3">
                {includedCustomisations.map((c) => {
                  const item = totalQuantity.find((item) => item.id === c.id);
                  const isIncluded = dessert.ingredients.includes(c.name);

                  return (
                    <div
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                      key={c.id}
                    >
                      <div className="flex items-center">
                        <span className="text-sm">
                          {language === "en" ? c.name : c.chineseName}
                        </span>
                        {isIncluded && (
                          <Badge
                            variant="secondary"
                            className="ml-2 mr-2 bg-green-100 text-green-800"
                          >
                            {language === "en" ? "Included" : "包括"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() =>
                            handleDecrease(c.id, c.name, c.chineseName)
                          }
                          disabled={item && item?.quantity === 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center">
                          {item?.quantity ?? 0}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() =>
                            handleIncrease(c.id, c.name, c.chineseName)
                          }
                          disabled={item && item?.quantity >= 5}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {additionalCustomisations.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium text-primary">
                {language === "en" ? "Additional Toppings" : "额外的配料"}
              </h3>
              <div className="space-y-3">
                {additionalCustomisations.map((c) => {
                  const item = totalQuantity.find((item) => item.id === c.id);

                  return (
                    <div
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                      key={c.id}
                    >
                      <div>
                        <span className="text-sm">
                          {language === "en" ? c.name : c.chineseName}
                        </span>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(c.priceInCents / 100)}{" "}
                          {language === "en" ? "each" : "每个"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() =>
                            handleDecrease(c.id, c.name, c.chineseName)
                          }
                          disabled={item && item?.quantity === 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center">
                          {item?.quantity ?? 0}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() =>
                            handleIncrease(c.id, c.name, c.chineseName)
                          }
                          disabled={item && item?.quantity >= 5}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Separator className="my-2" />

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {language === "en" ? "Quantity:" : "数量:"}
            </span>
            <div className="flex items-center">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 rounded-full p-0"
                onClick={() =>
                  setDessertQuantity((prev) => Math.max(prev - 1, 1))
                }
                disabled={dessertQuantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center">{dessertQuantity}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 rounded-full p-0"
                onClick={() =>
                  setDessertQuantity((prev) => Math.min(prev + 1, 20))
                }
                disabled={dessertQuantity >= 20}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-500">
              {language === "en" ? "Total" : "总计:"}
            </div>
            <div className="text-lg font-bold text-primary">
              {formatCurrency((totalPrice * dessertQuantity) / 100)}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            className="w-full py-6 text-lg"
            onClick={
              pathName === "/checkout"
                ? handleEditDessertToCart
                : handleAddDessertToCart
            }
          >
            {pathName === "/checkout"
              ? `${language === "en" ? "Edit" : "编辑"}`
              : `${language === "en" ? "Add to Cart" : "加"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
