"use client";

import { Check, X } from "lucide-react";
import { Category, Customisation } from "~/app/components/types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { ChevronDown } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { formatCurrency } from "~/lib/formatters";
import { Switch } from "~/components/ui/switch";

type CustomisationFormProps = {
  categories: Category[];
  customisation: Customisation;
  setCustomisation: React.Dispatch<React.SetStateAction<Customisation>>;
  setAddNewCustomisation?: React.Dispatch<React.SetStateAction<boolean>>;
  handleSave: () => void;
  error: string | null;
  popoverOpen: boolean;
  setPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isNew?: boolean;
};

export default function CustomisationForm({
  categories,
  customisation,
  setCustomisation,
  handleSave,
  error,
  popoverOpen,
  setPopoverOpen,
  isNew,
  setAddNewCustomisation,
}: CustomisationFormProps) {
  const handleCategoryChange = (category: Category) => {
    setCustomisation((prev) => {
      const updatedCategories = prev.categories.some(
        (c) => c.id === category.id,
      )
        ? prev.categories.filter((c) => c.id !== category.id)
        : [...prev.categories, { id: category.id, name: category.name }];
      return {
        ...prev,
        categories: updatedCategories,
      };
    });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="max-w-[425px] space-y-2 px-5"
    >
      {/* Customisation name */}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Customisation"
          value={customisation.name}
          onChange={(e) =>
            setCustomisation((prev) => ({
              ...prev,
              name: e.target.value,
            }))
          }
        />
        <div className="invisible flex gap-2">
          <Button>
            <Check />
          </Button>
          <Button>
            <X />
          </Button>
        </div>
      </div>

      {/* Chinese name */}

      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="定制名"
          value={customisation.chineseName}
          onChange={(e) =>
            setCustomisation((prev) => ({
              ...prev,
              chineseName: e.target.value,
            }))
          }
        />

        <div className="invisible flex gap-2">
          <Button>
            <Check />
          </Button>
          <Button>
            <X />
          </Button>
        </div>
      </div>
      {/* Select Category */}
      <div>
        <div className="flex gap-2">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={popoverOpen}
                className="w-full justify-between"
              >
                Select categories
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search categories..." />
                <CommandList>
                  <CommandEmpty>No categories found.</CommandEmpty>
                  <CommandGroup>
                    {categories?.map((category) => {
                      const isSelected = customisation.categories.some(
                        (c) => c.id === category.id,
                      );
                      return (
                        <CommandItem
                          key={category.id}
                          onSelect={() => {
                            handleCategoryChange(category);
                            // Keep the popover open for multiple selections
                          }}
                          className="flex items-center"
                        >
                          <div
                            className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <span>{category.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="invisible flex gap-2">
            <Button>
              <Check />
            </Button>
            <Button>
              <X />
            </Button>
          </div>
        </div>
        <div
          className={`flex flex-wrap gap-2 ${customisation.categories.length > 0 && "py-2"}`}
        >
          {customisation.categories.map((category) => (
            <Badge
              key={category.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {category.name}

              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleCategoryChange(category)}
              />
            </Badge>
          ))}
        </div>
      </div>

      {/* Price in cents */}
      <div className="flex gap-2">
        <Input
          className=""
          type="text"
          placeholder="Price in cents"
          value={customisation.priceInCents}
          onChange={(e) => {
            const value = e.target.value;

            // Check if the value is a valid number and does not start with '0' unless it's exactly '0'
            if (
              /^\d*$/.test(value) &&
              (value === "0" || !value.startsWith("0"))
            ) {
              setCustomisation((prev) => ({
                ...prev,
                priceInCents: value,
              }));
            }
          }}
        />
        <div className="pointer-events-none absolute right-40 mt-1">
          <span className="text-sm text-gray-600">
            {formatCurrency(Number(customisation.priceInCents) / 100)}
          </span>
        </div>

        <div className={`${isNew && "hidden"} invisible flex gap-2`}>
          <Button>
            <Check />
          </Button>
          <Button>
            <X />
          </Button>
        </div>

        <div className={`${isNew && setAddNewCustomisation ? "" : "hidden"}`}>
          {setAddNewCustomisation && (
            <div className="flex gap-2">
              <Button>
                <Check />
              </Button>
              <Button
                onClick={() => setAddNewCustomisation(false)}
                variant={"destructive"}
              >
                <X />
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className={`${isNew ? "hidden" : ""} flex gap-2`}>
        <Switch
          id="isAvailableForPurchase"
          name="isAvailableForPurchase"
          checked={customisation.isAvailableForPurchase}
          onCheckedChange={(value) =>
            setCustomisation((prev) => ({
              ...prev,
              isAvailableForPurchase: value,
            }))
          }
        />
      </div>
      {/* error message */}
      {error && (
        <span className="overflow-y-auto text-wrap text-destructive">
          {error}
        </span>
      )}
    </form>
  );
}
