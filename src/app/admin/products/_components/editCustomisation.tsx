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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Plus, X, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { formatCurrency } from "~/lib/formatters";

export function EditCustomisation() {
  const [dessertCustomisations] =
    api.productCustomisation.dessertCustomisations.useSuspenseQuery();
  const [editCustomisations, setEditCustomisations] = useState<
    typeof dessertCustomisations
  >(dessertCustomisations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCustomisation, setNewCustomisation] = useState({
    name: "",
    priceInCents: "",
  });
  const [addNewCustomisation, setAddNewCustomisation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const utils = api.useUtils();
  const createDessertCustomisation =
    api.productCustomisation.create.useMutation({
      onSuccess: async () => {
        await utils.productCustomisation.invalidate();
        setNewCustomisation({ name: "", priceInCents: "" });
        setEditCustomisations(dessertCustomisations);
        setAddNewCustomisation(false);
        setSaving(false);
        setDialogOpen(false);
      },
      onError: (error) => {
        setError(JSON.parse(error.message)[0].message);
      },
    });
  const updateDessertCustomisation =
    api.productCustomisation.update.useMutation({
      onSuccess: async () => {
        await utils.productCustomisation.invalidate();
        setEditCustomisations(dessertCustomisations);
        setSaving(false);
        setDialogOpen(false);
      },
    });

  const handleChange = (id: string, value: any) => {
    if (value.priceInCents) {
      if (Number(value.priceInCents) > 999999) {
        value.priceInCents = "0";
      }
    }
    setEditCustomisations((prev) =>
      prev.map((customisation) =>
        customisation.id === id
          ? { ...customisation, ...value }
          : customisation,
      ),
    );
  };

  const handleSave = (e: React.FormEvent) => {
    setSaving(true);
    e.preventDefault();
    setError(null);
    updateDessertCustomisation.mutate({ updates: editCustomisations });
  };

  const prevDialogOpen = useRef(dialogOpen);

  useEffect(() => {
    if (prevDialogOpen.current && !dialogOpen) {
      // ✅ Runs only when closing the dialog
      setEditCustomisations(dessertCustomisations);
      setAddNewCustomisation(false);
    }
    prevDialogOpen.current = dialogOpen; // Update previous value
  }, [dialogOpen]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button>Edit customisation</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Customisation</DialogTitle>
          <DialogDescription>
            Make changes to the customisations and hit "save" to save the
            changes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[40vh] flex-col gap-5 overflow-y-auto px-2 py-4">
          <div className="space-y-2 p-5">
            {editCustomisations.map((customisation) => (
              <div
                className="grid grid-cols-[auto_1fr_auto] items-center gap-4"
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
                <Label id={customisation.name} htmlFor={customisation.name}>
                  {customisation.name}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="min-w-[3rem] text-right text-base text-gray-600">
                    {formatCurrency(Number(customisation.priceInCents) / 100)}
                  </span>
                  <Input
                    className="w-24"
                    name="priceInCents"
                    value={customisation.priceInCents}
                    onChange={(e) => {
                      if (e.target.value.charAt(0) === "0") {
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
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add customisation Button */}

        <div className="px-5">
          {!addNewCustomisation ? (
            <Button onClick={() => setAddNewCustomisation(true)}>
              <Plus />
            </Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createDessertCustomisation.mutate({
                  name: newCustomisation.name,
                  priceInCents: Number(newCustomisation.priceInCents),
                });
              }}
              className="space-y-2"
            >
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Customisation"
                  value={newCustomisation.name}
                  onChange={(e) =>
                    setNewCustomisation((prev) => ({
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

              <div className="flex gap-2">
                <Input
                  className=""
                  type="text"
                  placeholder="Price in cents"
                  value={newCustomisation.priceInCents}
                  onChange={(e) => {
                    const value = e.target.value;

                    // Check if the value is a valid number and does not start with '0' unless it's exactly '0'
                    if (
                      /^\d*$/.test(value) &&
                      (value === "0" || !value.startsWith("0"))
                    ) {
                      setNewCustomisation((prev) => ({
                        ...prev,
                        priceInCents: value,
                      }));
                    }
                  }}
                />
                <div className="pointer-events-none absolute right-40 mt-1">
                  <span className="text-sm text-gray-600">
                    {formatCurrency(
                      Number(newCustomisation.priceInCents) / 100,
                    )}
                  </span>
                </div>

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
              {error && <span className="text-destructive">{error}</span>}
            </form>
          )}
        </div>
        <DialogFooter className="pt-8">
          {!addNewCustomisation && (
            <Button type="submit" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
