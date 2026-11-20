"use client";

import { SquarePen, Loader2 } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Stepper } from "~/components/ui/stepper";
import { formatCurrency } from "~/lib/formatters";
import { api } from "~/trpc/react";
import { nanoid } from "nanoid";
import { CartContext, CartItem } from "~/app/components/cartContext";
import Image from "next/image";
import { useLanguage } from "~/app/components/language";
import { DessertPrice } from "~/app/components/dessertPrice";
import { ItemName } from "~/app/components/itemName";
import { DESKTOP_MIN_WIDTH, useMinWidth } from "~/lib/browserState";
import { promoDiscountInCents } from "~/lib/dessertPricing";
import { cn } from "~/lib/utils";
import { usePathname } from "next/navigation";
import { dessertOnClient } from "~/lib/types";

type CustomisationDialogProps = {
  dessert: dessertOnClient;
  customOpen?: boolean;
  setCustomOpen?: (open: boolean) => void;
  onClose?: () => void;
  cartItem?: CartItem;
};

export default function CustomisationDialog({
  dessert,
  customOpen,
  setCustomOpen,
  onClose,
  cartItem,
}: CustomisationDialogProps) {
  const { data: customisations = [], isLoading: isCustomisationLoading } =
    api.productCustomisation.availableDessertCustomisations.useQuery({
      id: dessert.categoryId,
    });
  const { language } = useLanguage();
  const [totalQuantity, setTotalQuantity] = useState(
    customisations.map((customisation) => {
      const customisationIncluded = dessert.ingredients.some(
        (ingredient) => customisation.id === ingredient.id,
      );

      return {
        id: customisation.id,
        name: customisation.name,
        chineseName: customisation.chineseName,
        priceInCents: customisation.priceInCents,
        quantity: customisationIncluded ? 1 : 0,
      };
    }),
  );

  const [modifications, setModifications] = useState<typeof totalQuantity>(
    cartItem ? cartItem.customisations : [],
  );
  const discountedAmountInCents = promoDiscountInCents(dessert);
  // A centred dialog from md, a bottom sheet below it.
  const isDesktop = useMinWidth(DESKTOP_MIN_WIDTH);

  const priceInCentsAfterPromo = dessert.priceInCents - discountedAmountInCents;
  // const [totalPrice, setTotalPrice] = useState(
  //   cartItem
  //     ? cartItem.priceInCents -
  //         cartItem.discountedAmountInCents +
  //         cartItem.customisations.reduce(
  //           (acc, item) => acc + item.priceInCents * item.quantity,
  //           0,
  //         ) // edit stage
  //     : priceInCentsAfterPromo, // add new item stage
  // );
  const [dessertQuantity, setDessertQuantity] = useState(
    cartItem ? cartItem.quantity : 1,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const cart = useContext(CartContext);
  const pathName = usePathname();

  useEffect(() => {
    if (!customisations.length) return;

    setTotalQuantity(
      customisations.map((customisation) => {
        const customisationIncluded = dessert.ingredients.some(
          (ingredient) => customisation.id === ingredient.id,
        );

        return {
          id: customisation.id,
          name: customisation.name,
          chineseName: customisation.chineseName,
          priceInCents: customisation.priceInCents,
          quantity: customisationIncluded ? 1 : 0,
        };
      }),
    );
  }, [customisations, dessert]);

  // useEffect(() => {
  //   if (!dessert) return;
  //   const totalPrice = modifications.reduce((acc, item) => {
  //     // Find the customisation with the same ID
  //     const customisation = customisations.find(
  //       (custom) => custom.id === item.id,
  //     );

  //     // If customisation is found, calculate the price
  //     if (customisation) {
  //       acc += customisation.priceInCents * item.quantity;
  //     }

  //     return acc;
  //   }, 0);

  //   setTotalPrice(totalPrice + priceInCentsAfterPromo);
  // }, [totalQuantity, modifications, customisations, dessert, dessertQuantity]);

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
          : [
              ...prev,
              {
                id,
                name,
                chineseName,
                priceInCents: getCustomisationQuantity.priceInCents,
                quantity: 1,
              },
            ]; // Initialize if missing
      });
    } else if (
      getCustomisationQuantity &&
      getCustomisationQuantity.quantity === 0
    ) {
      setModifications((prev) => {
        const customisationNotInDessert = !dessert.ingredients.some(
          (ingredient) => ingredient.id === id,
        );
        const exists = prev.some((item) => item.id === id);
        if (customisationNotInDessert) {
          return [
            ...prev,
            {
              id,
              name,
              chineseName,
              priceInCents: getCustomisationQuantity.priceInCents,
              quantity: 1,
            },
          ];
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
    const customisationNotInDessert = !dessert.ingredients.some(
      (ingredient) => ingredient.id === id,
    );

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
        return [
          ...prev,
          {
            id,
            name,
            chineseName,
            priceInCents: getCustomisationQuantity.priceInCents,
            quantity: 0,
          },
        ];
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

  const handleOpenClose = () => {
    if (setCustomOpen) {
      setCustomOpen(false);
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
        const customisationIncluded = dessert.ingredients.some(
          (ingredient) => ingredient.id === customisation.id,
        );

        return {
          id: customisation.id,
          name: customisation.name,
          chineseName: customisation.chineseName,
          priceInCents: customisation.priceInCents,
          quantity:
            previousQuantity && previousQuantity > 0 && customisationIncluded
              ? previousQuantity + 1
              : (previousQuantity ?? (customisationIncluded ? 1 : 0)), //check if customisation have a previous quantity in cart and is included in dessert, if so add 1 to the previous quantity else if previous quantity set customisation quantity to previous quantity else 1 or 0 if customisation is included in dessert or not.
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
      priceInCents: dessert.priceInCents,
      quantity: dessertQuantity,
      discountedAmountInCents,
    };

    if (!cart) return null;
    cart.addToCart(item);
    handleOpenClose();
    return;
  };

  const handleEditDessertToCart = () => {
    if (!cart || !cartItem) return;
    const item = {
      id: cartItem.id,
      customisations: modifications,
      dessert,
      priceInCents: dessert.priceInCents,
      quantity: dessertQuantity,
      discountedAmountInCents: cartItem.discountedAmountInCents,
    };

    cart.updateItemFromCart(cartItem.id, item);
    handleOpenClose();
    return;
  };

  // Group customizations by included vs additional
  const includedCustomisations = customisations.filter((c) =>
    dessert.ingredients.some((ingredient) => ingredient.id === c.id),
  );

  const additionalCustomisations = customisations.filter(
    (c) => !dessert.ingredients.some((ingredient) => ingredient.id === c.id),
  );

  if (isCustomisationLoading) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  const en = language === "en";
  const editing = pathName === "/checkout";
  // The same sums the dialog always showed, now on the Add to cart button.
  const extrasInCents = modifications.reduce(
    (acc, m) => acc + m.priceInCents * m.quantity,
    0,
  );
  const totalInCents =
    (priceInCentsAfterPromo + extrasInCents) * dessertQuantity;
  const totalBeforePromoInCents =
    (dessert.priceInCents + extrasInCents) * dessertQuantity;

  const customisationRow = (
    c: (typeof customisations)[number],
    included: boolean,
  ) => {
    const item = totalQuantity.find((item) => item.id === c.id);
    const name = en ? c.name : c.chineseName;
    const each = formatCurrency(c.priceInCents / 100);
    return (
      <li
        key={c.id}
        className="flex items-center gap-2 border-b border-border py-1.5 last:border-b-0 md:gap-2.5 md:py-2.5"
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <ItemName
            name={c.name}
            chineseName={c.chineseName}
            layout="inline"
            leadClassName="text-[15px] font-semibold md:text-base"
            secondClassName="text-sm"
          />
          <span className="text-[13px] tabular-nums text-muted-foreground md:text-sm">
            {/* An ingredient already in the bowl costs this much for each one
                more; a topping costs it for each one added. */}
            {included
              ? en
                ? `Extra +${each} each`
                : `加量 +${each} 每个`
              : en
                ? `+${each} each`
                : `+${each} 每个`}
          </span>
        </div>
        <Stepper
          size={isDesktop ? "md" : "sm"}
          value={item?.quantity ?? 0}
          onDecrease={() => handleDecrease(c.id, c.name, c.chineseName)}
          onIncrease={() => handleIncrease(c.id, c.name, c.chineseName)}
          decreaseDisabled={item && item?.quantity === 0}
          increaseDisabled={item && item?.quantity >= 5}
          decreaseLabel={en ? `One fewer ${name}` : `少一份${name}`}
          increaseLabel={en ? `One more ${name}` : `多一份${name}`}
        />
      </li>
    );
  };

  return (
    <Sheet
      open={customOpen ? customOpen : dialogOpen}
      onOpenChange={handleOpenClose}
    >
      {!customOpen && (
        <SheetTrigger asChild>
          {editing ? (
            // The order summary's edit button. It had no name, so a screen reader
            // announced only "button" beside every dessert.
            <Button
              variant="ghost"
              size="round"
              aria-label={
                en ? `Edit ${dessert.name}` : `编辑${dessert.chineseName}`
              }
            >
              <SquarePen
                className="!size-[18px]"
                strokeWidth={1.8}
                aria-hidden
              />
            </Button>
          ) : (
            <Button className="w-full" size="icon" />
          )}
        </SheetTrigger>
      )}

      <SheetContent
        side={isDesktop ? "center" : "bottom"}
        aria-describedby={undefined}
        className={cn(isDesktop ? "max-w-[880px]" : "h-[88dvh]")}
      >
        <div className="relative flex shrink-0 items-center gap-4 px-5 pb-4 pt-1.5 md:gap-6 md:px-8 md:pb-[22px] md:pt-7">
          <span className="relative h-[132px] w-[132px] shrink-0 overflow-hidden rounded-full bg-muted md:h-[168px] md:w-[168px]">
            {dessert.imagePath && (
              <Image
                src={dessert.imagePath}
                alt={en ? dessert.name : dessert.chineseName}
                fill
                className="object-cover"
                sizes="168px"
              />
            )}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5 pr-10 md:gap-1 md:pr-12">
            <SheetTitle className="leading-none">
              <ItemName
                name={dessert.name}
                chineseName={dessert.chineseName}
                className="gap-1"
                leadClassName="text-[28px] font-extrabold leading-[1.1] md:text-[34px] md:leading-[1.05]"
                secondClassName="text-[21px] text-accent md:text-2xl"
              />
            </SheetTitle>
            <DessertPrice
              dessert={dessert}
              language={language}
              className="mt-1.5 md:mt-2"
              priceClassName="text-[17px] md:text-[19px]"
            />
            {dessert.description && (
              <p className="text-[15px] text-muted-foreground">
                {dessert.description}
              </p>
            )}
            {customisations.length > 0 && (
              <p className="hidden text-[15px] text-muted-foreground md:block">
                {en ? "Customise your dessert below." : "在下面定制您的甜点"}
              </p>
            )}
          </div>
          <SheetCloseButton
            label={en ? "Close" : "关闭"}
            className="absolute right-3.5 top-0 md:right-5 md:top-5"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-5 pb-3 md:grid md:grid-cols-2 md:content-start md:gap-x-10 md:px-8">
          {includedCustomisations.length > 0 && (
            <section>
              <h3 className="mb-0.5 mt-3.5 text-base font-extrabold md:mb-1 md:text-[17px]">
                {en ? "In this bowl" : "包含成分"}
              </h3>
              <ul>
                {includedCustomisations.map((c) => customisationRow(c, true))}
              </ul>
            </section>
          )}
          {additionalCustomisations.length > 0 && (
            <section>
              <h3 className="mb-0.5 mt-3.5 text-base font-extrabold md:mb-1 md:text-[17px]">
                {en ? "Add toppings" : "额外的配料"}
              </h3>
              <ul>
                {additionalCustomisations.map((c) =>
                  customisationRow(c, false),
                )}
              </ul>
            </section>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-5 pb-6 pt-3.5 md:px-8 md:py-4">
          <div className="flex items-center gap-1.5">
            <span className="mr-1 hidden text-base font-bold md:inline">
              {en ? "Quantity" : "数量"}
            </span>
            <Stepper
              size="lg"
              value={dessertQuantity}
              onDecrease={() =>
                setDessertQuantity((prev) => Math.max(prev - 1, 1))
              }
              onIncrease={() =>
                setDessertQuantity((prev) => Math.min(prev + 1, 20))
              }
              decreaseDisabled={dessertQuantity <= 1}
              increaseDisabled={dessertQuantity >= 20}
              decreaseLabel={en ? "One fewer" : "少一份"}
              increaseLabel={en ? "One more" : "多一份"}
            />
          </div>
          <Button
            size="cta"
            className="min-w-0 flex-1 justify-between gap-3 px-6 md:max-w-[380px] md:px-[26px]"
            onClick={editing ? handleEditDessertToCart : handleAddDessertToCart}
          >
            <span className="truncate">
              {editing ? (en ? "Edit" : "编辑") : en ? "Add to cart" : "加"}
            </span>
            <span className="flex items-baseline gap-2 tabular-nums">
              {dessert.promo && (
                <span className="text-sm font-semibold line-through opacity-70">
                  {formatCurrency(totalBeforePromoInCents / 100)}
                </span>
              )}
              {formatCurrency(totalInCents / 100)}
            </span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
