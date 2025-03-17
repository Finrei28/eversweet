"use client";

import { useState, useEffect, useRef, SetStateAction, Dispatch } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import Image from "next/image";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormInput,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormStatus } from "react-dom";
import { formatCurrency } from "~/lib/formatters";
import { addSchema } from "~/app/components/schemas";
import { api } from "~/trpc/react";

// Validation schemas

interface Field {
  id: string;
  label: string;
  type?: string;
  value?: string;
}

interface AddProductProps {
  triggerText: string;
  title: string;
  description: string;
  fields: Field[];
  submitText: string;
}

export function AddProduct({
  triggerText,
  title,
  description,
  fields,
  submitText,
}: AddProductProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [priceInCents, setPriceInCents] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const utils = api.useUtils();
  const addProduct = api.dessert.createProduct.useMutation({
    onSuccess: async () => {
      await utils.dessert.invalidate();
      setAddLoading(false);
      setDialogOpen(false);
    },
    onError: (error) => {
      setError(JSON.parse(error.message)[0].message);
    },
  });

  // Forms
  const addForm = useForm<z.infer<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: {
      name: "",
      chineseName: "",
      description: "",
      ingredients: "",
      priceInCents: 0,
      image: new File([], ""),
    },
  });

  // Handle submit for add form
  const handleAddSubmit = async (data: z.infer<typeof addSchema>) => {
    setAddLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("image", data.image);
    const res = await fetch(`/admin/products/api/uploadImage`, {
      method: "POST",
      body: formData,
    });
    const result = await res.json();

    if (res.ok && result) {
      addProduct.mutate({
        product: {
          ...data,
          imagePath: result.imagePath,
          imagePublicId: result.publicId,
        },
      });
    } else {
      setError(result.error);
    }
  };

  const prevDialogOpen = useRef(dialogOpen);

  useEffect(() => {
    if (prevDialogOpen.current && !dialogOpen) {
      // ✅ Runs only when closing the dialog
      addForm.clearErrors();
      addForm.reset();
      setImagePreview(null);
      setPriceInCents(null);
      setError(null);
    }
    prevDialogOpen.current = dialogOpen; // Update previous value
  }, [dialogOpen]);
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button>{triggerText}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Form toggle between Add and Edit */}
        <Form {...addForm}>
          <form
            onSubmit={addForm.handleSubmit(handleAddSubmit)} // Fix the submit handler to use handleAddSubmit for adding
            className="grid gap-4"
          >
            {fields.map(({ id, label, type = "text", value }) => (
              <div key={id} className="grid grid-cols-4 items-center">
                <>
                  <FormField
                    control={addForm.control}
                    name={
                      id as
                        | "name"
                        | "chineseName"
                        | "priceInCents"
                        | "description"
                        | "ingredients"
                        | "image"
                    }
                    render={({ field }) => (
                      <>
                        <FormLabel htmlFor={id} className="text-right">
                          {label}
                        </FormLabel>
                        <div className="col-span-3 ml-2 w-full">
                          <div className="relative">
                            <FormControl>
                              {typeof field.value === "object" ? (
                                <FormInput
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      const file = e.target.files[0];
                                      field.onChange(file);
                                      setImagePreview(
                                        URL.createObjectURL(file),
                                      ); // Create preview URL
                                    }
                                  }}
                                />
                              ) : (
                                <FormInput
                                  {...field}
                                  type={type}
                                  value={field.value}
                                  onChange={
                                    id === "priceInCents"
                                      ? (e) => {
                                          if (
                                            e.target.value.charAt(0) === "0"
                                          ) {
                                            e.target.value =
                                              e.target.value.slice(1);
                                          }
                                          setPriceInCents(
                                            Number(e.target.value),
                                          ); // Update priceInCents directly
                                          if (
                                            /^\d*$/.test(e.target.value) &&
                                            !e.target.value.startsWith("0")
                                          )
                                            field.onChange(e); // Make sure other fields still update correctly
                                        }
                                      : field.onChange
                                  }
                                />
                              )}
                            </FormControl>

                            {id === "priceInCents" && (
                              <div className="pointer-events-none absolute bottom-0 right-0 pb-2 pr-3">
                                <span className="text-sm text-gray-600">
                                  {priceInCents && !isNaN(Number(priceInCents))
                                    ? formatCurrency(Number(priceInCents) / 100)
                                    : value && !isNaN(Number(value))
                                      ? formatCurrency(Number(value) / 100)
                                      : formatCurrency(Number(0))}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <FormMessage />
                          </div>
                        </div>
                        {/* Image preview */}
                        {id === "image" && imagePreview && (
                          <div className="col-span-4 mt-2">
                            <div className="max-w-full overflow-hidden">
                              <p
                                className="mb-1 truncate text-sm text-gray-500"
                                title={value as string}
                              >
                                {value}
                              </p>
                              <div className="relative h-[200px] w-[200px] overflow-hidden rounded-md border">
                                <Image
                                  src={imagePreview || "/placeholder.svg"}
                                  alt="Product preview"
                                  fill
                                  className="object-cover"
                                  sizes="200px"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  />
                </>
              </div>
            ))}
            {error && (
              <span className="flex flex-col items-center justify-center text-destructive">
                {error}
              </span>
            )}
            <DialogFooter>
              <div className="flex w-full flex-col items-center justify-center">
                <SubmitButton
                  submitText={submitText}
                  setAddLoading={setAddLoading}
                  addLoading={addLoading}
                />
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({
  submitText,
  setAddLoading,
  addLoading,
}: {
  submitText: string;
  setAddLoading: Dispatch<SetStateAction<boolean>>;
  addLoading: boolean;
}) {
  return (
    <Button
      type="submit"
      disabled={addLoading}
      className="mt-5 w-10/12 rounded-xl"
    >
      {addLoading ? "Submitting..." : submitText}
    </Button>
  );
}
