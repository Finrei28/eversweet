"use client";

import type React from "react";

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
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

import { Category } from "~/app/components/types";

import EditCustomisationDialog from "./editCustomisationDialog";
import CustomisationForm from "./customisationForm";
import { useLanguage } from "~/app/components/language";

export function EditCustomisation() {
  const { language } = useLanguage();
  const [dessertCustomisations] =
    api.productCustomisation.dessertCustomisations.useSuspenseQuery();
  const [categories] = api.dessert.getCategories.useSuspenseQuery();
  const [editManyCustomisations, setEditManyCustomisations] = useState<
    typeof dessertCustomisations
  >(dessertCustomisations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCustomisation, setNewCustomisation] = useState({
    name: "",
    chineseName: "",
    priceInCents: "",
    categories: [] as Category[],
  });
  const [addNewCustomisation, setAddNewCustomisation] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const utils = api.useUtils();
  const createDessertCustomisation =
    api.productCustomisation.create.useMutation({
      onSuccess: async () => {
        await utils.productCustomisation.invalidate();
        setNewCustomisation({
          name: "",
          chineseName: "",
          priceInCents: "",
          categories: [] as Category[],
        });
        setEditManyCustomisations(dessertCustomisations);
        setAddNewCustomisation(false);
        setSaving(false);
        setDialogOpen(false);
      },
      onError: (error) => {
        setError(error.message);
      },
    });
  const updateManyDessertCustomisation =
    api.productCustomisation.updateMany.useMutation({
      onSuccess: async () => {
        await utils.productCustomisation.invalidate();
        setEditManyCustomisations(dessertCustomisations);
        setSaving(false);
        setDialogOpen(false);
      },
    });

  const updateDessertCustomisation =
    api.productCustomisation.update.useMutation({
      onSuccess: async (updatedCustomisations) => {
        await utils.productCustomisation.invalidate();
        await utils.productCustomisation.dessertCustomisations.invalidate();
        setEditManyCustomisations((prev) => {
          // Find the customisation to update
          return prev.map(
            (customisation) =>
              customisation.id === updatedCustomisations.id
                ? { ...customisation, ...updatedCustomisations } // Merge updated data
                : customisation, // Keep other customisations unchanged
          );
        });
        setSaving(false);
      },
    });

  const handleChange = (id: string, value: any) => {
    if (value.priceInCents) {
      if (Number(value.priceInCents) > 999999) {
        value.priceInCents = "0";
      }
    }
    setEditManyCustomisations((prev) =>
      prev.map((customisation) =>
        customisation.id === id
          ? { ...customisation, ...value }
          : customisation,
      ),
    );
  };

  const handleCreateNewCustomisation = () => {
    createDessertCustomisation.mutate({
      name: newCustomisation.name,
      chineseName: newCustomisation.chineseName,
      priceInCents: Number(newCustomisation.priceInCents),
      categories: newCustomisation.categories.map((c) => c.id),
    });
  };

  const handleUpdateMany = (e: React.FormEvent) => {
    setSaving(true);
    e.preventDefault();
    setError(null);
    updateManyDessertCustomisation.mutate({ updates: editManyCustomisations });
  };

  const prevDialogOpen = useRef(dialogOpen);

  useEffect(() => {
    if (prevDialogOpen.current && !dialogOpen) {
      // ✅ Runs only when closing the dialog
      setEditManyCustomisations(dessertCustomisations);
      setAddNewCustomisation(false);
      setNewCustomisation({
        name: "",
        chineseName: "",
        priceInCents: "",
        categories: [] as Category[],
      });
      setError(null);
    }
    prevDialogOpen.current = dialogOpen; // Update previous value
  }, [dialogOpen, dessertCustomisations]);

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        // Only allow closing if popover is closed
        if (!open && popoverOpen) {
          return;
        }
        setDialogOpen(open);
      }}
    >
      <DialogTrigger asChild>
        <Button>{language === "en" ? "Edit customisation" : "该定制"}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[95vh] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {language === "en" ? "Edit customisation" : "该定制"}
          </DialogTitle>
          <DialogDescription>
            {language === "en"
              ? "Make changes to the customisations and hit 'save' to save thechanges."
              : "进行更改以自定义产品并单击“保存”以保存更改"}
          </DialogDescription>
        </DialogHeader>
        <div
          className={`flex ${addNewCustomisation ? "max-h-[40vh]" : "max-h-[55vh]"} flex-col overflow-y-auto py-4`}
        >
          <div className="space-y-2 p-2">
            {editManyCustomisations.map((customisation) => {
              return (
                <div
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-1"
                  key={customisation.id}
                >
                  <Switch
                    id="isAvailableForPurchase"
                    name="isAvailableForPurchase"
                    checked={customisation.isAvailableForPurchase}
                    onCheckedChange={(value) =>
                      handleChange(customisation.id, {
                        isAvailableForPurchase: value,
                      })
                    }
                  />
                  <div className="flex items-center">
                    <Label id={customisation.name} htmlFor={customisation.name}>
                      {customisation.name}
                    </Label>
                    <Label
                      id={customisation.chineseName}
                      htmlFor={customisation.chineseName}
                    >
                      ({customisation.chineseName})
                    </Label>
                  </div>

                  <EditCustomisationDialog
                    customisation={{
                      ...customisation,
                      priceInCents: customisation.priceInCents.toString(),
                    }}
                    categories={categories}
                    updateDessertCustomisation={updateDessertCustomisation}
                    saving={saving}
                    setSaving={setSaving}
                  />

                  {/* <div className="flex items-center gap-2">
                  <span className="min-w-[3rem] text-right text-base text-gray-600">
                    {formatCurrency(Number(customisation.priceInCents) / 100)}
                  </span>
                  <Input
                    className="w-24"
                    name="priceInCents"
                    value={customisation.priceInCents}
                    onChange={(e) => {
                      if (e.target.value.charAt(0).startsWith("0")) {
                        e.target.value = e.target.value.slice(1);
                      }
                      // Check if the value is a valid number and does not start with '0' unless it's exactly '0'
                      if (
                        /^\d*$/.test(e.target.value) &&
                        !e.target.value.startsWith("0")
                      ) {
                        handleChange(customisation.id, {
                          priceInCents: Number(e.target.value),
                        });
                      }
                    }}
                  />
                </div> */}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add new customisation */}

        <div>
          {!addNewCustomisation ? (
            <Button onClick={() => setAddNewCustomisation(true)}>
              <Plus />
            </Button>
          ) : (
            <CustomisationForm
              setCustomisation={setNewCustomisation}
              customisation={newCustomisation}
              categories={categories}
              handleSave={handleCreateNewCustomisation}
              error={error}
              popoverOpen={popoverOpen}
              setPopoverOpen={setPopoverOpen}
              setAddNewCustomisation={setAddNewCustomisation}
              isNew={true}
            />
          )}
        </div>
        <DialogFooter className="">
          {!addNewCustomisation && (
            <Button type="submit" onClick={handleUpdateMany} disabled={saving}>
              {saving
                ? language === "en"
                  ? "Saving..."
                  : "正在更改"
                : language === "en"
                  ? "Save changes"
                  : "保存更改"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
