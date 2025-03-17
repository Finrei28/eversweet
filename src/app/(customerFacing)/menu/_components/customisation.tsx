"use client";

import { Minus, Plus, Info } from "lucide-react";
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
import { CartContext } from "~/app/components/cartContext";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type CustomisationDialogProps = {
  dessert: {
    description: string;
    name: string;
    id: string;
    chineseName: string;
    priceInCents: number;
    imagePath: string;
    ingredients: string[];
  };
  homePageOpen?: boolean;
  setHomePageOpen?: (open: boolean) => void;
  onClose?: () => void;
};

export default function CustomisationDialog({
  dessert,
  homePageOpen,
  setHomePageOpen,
  onClose,
}: CustomisationDialogProps) {
  const [customisations] =
    api.productCustomisation.availableDessertCustomisations.useSuspenseQuery();
  const [totalQuantity, setTotalQuantity] = useState(
    customisations.map((customisation) => ({
      id: customisation.id,
      name: customisation.name,
      quantity: dessert.ingredients.includes(customisation.name) ? 1 : 0,
    })),
  );
  const [modifications, setModifications] = useState<typeof totalQuantity>([]);
  const [totalPrice, setTotalPrice] = useState(dessert.priceInCents);
  const [dessertQuantity, setDessertQuantity] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const cart = useContext(CartContext);

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
  const handleIncrease = (id: string, name: string) => {
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
          : [...prev, { id, name, quantity: 1 }]; // Initialize if missing
      });
    } else if (
      getCustomisationQuantity &&
      getCustomisationQuantity.quantity === 0
    ) {
      setModifications((prev) => {
        const customisationNotInDessert = !dessert.ingredients.includes(name);
        const exists = prev.some((item) => item.id === id);
        if (customisationNotInDessert) {
          return [...prev, { id, name, quantity: 1 }];
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
  const handleDecrease = (id: string, name: string) => {
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
        return [...prev, { id, name, quantity: 0 }];
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
      customisations.map((customisation) => ({
        id: customisation.id,
        name: customisation.name,
        quantity: dessert.ingredients.includes(customisation.name) ? 1 : 0,
      })),
    );
    setModifications([]);
    setDessertQuantity(1);
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
          <Button className="w-full">Customise goodie</Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="mb-1 text-xl text-primary">
                {dessert.name}
                {dessert.chineseName && (
                  <span className="ml-2 text-sm text-gray-500">
                    {dessert.chineseName}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-start">
                {dessert.description}
              </DialogDescription>
            </div>

            {dessert.imagePath && (
              <div className="relative ml-4 mr-2 mt-2 h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
                <Image
                  src={dessert.imagePath || "/placeholder.svg"}
                  alt={dessert.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center">
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
                  <p>Customize your dessert below</p>
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
                Included Ingredients
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
                        <span className="text-sm">{c.name}</span>
                        {isIncluded && (
                          <Badge
                            variant="secondary"
                            className="ml-2 mr-2 bg-green-100 text-green-800"
                          >
                            Included
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() => handleDecrease(c.id, c.name)}
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
                          onClick={() => handleIncrease(c.id, c.name)}
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
                Additional Toppings
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
                        <span className="text-sm">{c.name}</span>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(c.priceInCents / 100)} each
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() => handleDecrease(c.id, c.name)}
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
                          onClick={() => handleIncrease(c.id, c.name)}
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
            <span className="text-sm font-medium">Quantity:</span>
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
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-lg font-bold text-primary">
              {formatCurrency((totalPrice * dessertQuantity) / 100)}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            className="w-full py-6 text-lg"
            onClick={handleAddDessertToCart}
          >
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
