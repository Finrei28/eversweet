"use client";

import type React from "react";

import { Edit } from "lucide-react";
import CustomDialog from "~/app/components/customDialog";
import type { Category, Customisation } from "~/app/components/types";
import { Button } from "~/components/ui/button";
import CustomisationForm from "./customisationForm";
import { useState, useEffect, useRef } from "react";
import type { UseTRPCMutationResult } from "@trpc/react-query/shared";

type EditCustomisationDialogProps = {
  customisation: Customisation;
  categories: Category[];
  updateDessertCustomisation: UseTRPCMutationResult<any, any, any, any>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  // Remove these props as they're causing the issue
  // editOpen: boolean;
  // setEditOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function EditCustomisationDialog({
  customisation,
  categories,
  updateDessertCustomisation,
  saving,
  setSaving,
}: EditCustomisationDialogProps) {
  // Create a local state for this specific dialog
  const [isOpen, setIsOpen] = useState(false);
  const [editCustomisation, setEditCustomisation] =
    useState<Customisation>(customisation);
  const [error, setError] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const prevDialogOpen = useRef(isOpen);

  useEffect(() => {
    if (prevDialogOpen.current && !isOpen) {
      // ✅ Runs only when closing the dialog
      setEditCustomisation(customisation);
      setError(null);
    }
    prevDialogOpen.current = isOpen; // Update previous value
  }, [isOpen, customisation]);

  // Listen for successful updates from the parent component
  const prevSaving = useRef(saving);

  useEffect(() => {
    if (prevSaving.current && !saving && !error && isOpen) {
      setIsOpen(false);
    }
    prevSaving.current = saving; // Update previous value
  }, [saving, error, isOpen]);

  const handleUpdateCustomisation = () => {
    if (!editCustomisation.id) {
      setError("Id is not provided");
      return;
    }
    if (
      !editCustomisation.name ||
      !editCustomisation.chineseName ||
      !editCustomisation.priceInCents ||
      !(editCustomisation.categories.length > 0) ||
      Number(editCustomisation.priceInCents) <= 0
    ) {
      setError("Please check all fields and try again");
      return;
    }
    setSaving(true);
    setError(null);
    const categories = editCustomisation.categories.map((c) => c.id);
    const id = editCustomisation.id;
    const priceInCents = Number(editCustomisation.priceInCents);

    updateDessertCustomisation.mutate({
      ...editCustomisation,
      categories,
      priceInCents,
      id,
    });
  };

  const onOpenChange = (open: boolean) => {
    // Only allow closing if popover is closed
    if (!open && popoverOpen) {
      return;
    }
    setIsOpen(open);
  };

  return (
    <div className="flex justify-end gap-6">
      <CustomDialog
        dialogOpen={isOpen}
        onOpenChange={onOpenChange}
        trigger={
          <Button variant="outline">
            <Edit className="h-5 w-5 hover:cursor-pointer" />
          </Button>
        }
        title={`Edit ${customisation.name}`}
        description="Edit the customisation and hit save to save the changes."
        content={
          <CustomisationForm
            categories={categories}
            customisation={editCustomisation}
            setCustomisation={setEditCustomisation}
            handleSave={handleUpdateCustomisation}
            error={error}
            popoverOpen={popoverOpen}
            setPopoverOpen={setPopoverOpen}
          />
        }
        footer={
          <Button
            type="button"
            onClick={handleUpdateCustomisation}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        }
      />
    </div>
  );
}
