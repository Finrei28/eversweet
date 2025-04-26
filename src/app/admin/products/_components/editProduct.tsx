"use client";

import { useState, useEffect, useRef } from "react";
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
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import Image from "next/image";
import type { z } from "zod";
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
import { formatCurrency } from "~/lib/formatters";
import { editSchema } from "~/app/components/schemas";
import type { Category, DessertOnForm } from "~/app/components/types";
import { api } from "~/trpc/react";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "~/hooks/use-toast";
import { useLanguage } from "~/app/components/language";

interface Field {
  id: string;
  label: string;
  type?: string;
  value?: string;
}

interface EditProductProps {
  triggerText: string;
  title: string;
  description: string;
  fields: Field[];
  submitText: string;
  formDefaultValues: DessertOnForm;
  categories: Category[];
}

export function EditProduct({
  triggerText,
  title,
  description,
  fields,
  submitText,
  formDefaultValues,
  categories,
}: EditProductProps) {
  const { language } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [priceInCents, setPriceInCents] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(
    formDefaultValues.imagePath,
  );
  const [error, setError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const utils = api.useUtils();
  const editProduct = api.dessert.editProduct.useMutation({
    onSuccess: async (data) => {
      await utils.dessert.invalidate();
      setEditLoading(false);
      setDialogOpen(false);
      toast({
        title:
          language === "en" ? "Product edited successfully" : "甜品编辑成功",
        description:
          language === "en"
            ? `${data.name} has been edited successfully...`
            : `${data.chineseName}已成功编辑...`,
      });
    },
    onError: (error) => {
      if (!error.data?.zodError) {
        setError(error.message);
        return;
      }
      setError(JSON.parse(error.message)[0].message);
    },
  });

  // Forms
  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      ...formDefaultValues,
      categoryId: formDefaultValues.category.id,
      image: new File([], ""),
    },
  });

  useEffect(() => {
    // Reset form values if formDefaultValues change
    editForm.reset({
      ...formDefaultValues,
      categoryId: formDefaultValues.category.id,
      image: new File([], ""),
    });
    setImagePreview(formDefaultValues.imagePath); // Update the image preview
    setPriceInCents(formDefaultValues.priceInCents || null); // Update price if available
  }, [formDefaultValues, editForm]);

  // Handle submit for edit form
  const handleEditSubmit = async (data: z.infer<typeof editSchema>) => {
    setEditLoading(true);
    setError(null);
    const formData = new FormData();
    let imagePath = "";
    let imagePublicId = "";
    if (data.image && data.image?.size > 0) {
      formData.append("image", data.image);
      formData.append("productId", formDefaultValues.id);
      const res = await fetch(`/admin/products/api/updateImage`, {
        method: "PATCH",
        body: formData,
      });
      const result = await res.json();
      if (res.ok) {
        imagePath = result.imagePath;
        imagePublicId = result.imagePublicId;
      } else {
        setError(result.error);
      }
    }

    editProduct.mutate({
      productToUpdate: {
        ...data,
        imagePath,
        imagePublicId,
        id: formDefaultValues.id,
      },
    });
  };

  const prevDialogOpen = useRef(dialogOpen);

  useEffect(() => {
    if (prevDialogOpen.current && !dialogOpen) {
      // ✅ Runs only when closing the dialog
      editForm.clearErrors();
      editForm.reset();
      setImagePreview(formDefaultValues.imagePath);
      setPriceInCents(null);
      setError(null);
    }
    prevDialogOpen.current = dialogOpen; // Update previous value
  }, [dialogOpen, editForm, formDefaultValues]);
  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="rounded-xl">{triggerText}</Button>
        </DialogTrigger>
        <DialogContent className="h-[95vh] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {/* Form toggle between Add and Edit */}
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditSubmit)} // Fix the submit handler to use handleAddSubmit for adding
              className={`${!error && !(Object.keys(editForm.formState.errors).length > 0) ? "lg:h-auto" : ""} flex h-[80vh] flex-col gap-4 overflow-y-auto pb-2`}
            >
              {fields.map(({ id, label, type = "text", value }) => (
                <div key={id} className="grid grid-cols-4 items-center">
                  {id === "id" ? (
                    <Label id={id} hidden />
                  ) : (
                    <>
                      <FormField
                        control={editForm.control}
                        name={
                          id as
                            | "name"
                            | "chineseName"
                            | "priceInCents"
                            | "description"
                            | "ingredients"
                            | "image"
                            | "isAvailableForPurchase"
                            | "categoryId"
                        }
                        render={({ field }) => (
                          <>
                            <FormLabel htmlFor={id} className="">
                              {label}
                            </FormLabel>
                            <div className="col-span-3 ml-2">
                              <div className="relative">
                                <FormControl>
                                  {id === "isAvailableForPurchase" ? (
                                    <Checkbox
                                      id={id}
                                      name={id}
                                      defaultChecked={value === "true"}
                                      className="flex items-center"
                                      onCheckedChange={field.onChange.bind(
                                        field,
                                      )}
                                    />
                                  ) : typeof field.value === "object" ? (
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
                                  ) : id === "description" ||
                                    id === "ingredients" ? (
                                    <Textarea
                                      draggable="false"
                                      value={field.value?.toString()}
                                      onChange={field.onChange}
                                      className="resize-none"
                                    />
                                  ) : id === "categoryId" ? (
                                    <Select
                                      defaultValue={
                                        formDefaultValues.category.id
                                      }
                                      onValueChange={(value) =>
                                        field.onChange(value)
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue
                                        // placeholder="Select a category"
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectGroup>
                                          <SelectLabel>Category</SelectLabel>
                                          {categories.map((category) => {
                                            return (
                                              <SelectItem
                                                key={category.id}
                                                value={category.id}
                                              >
                                                {category.name}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <FormInput
                                      {...field}
                                      type={type}
                                      value={field.value?.toString()}
                                      onChange={
                                        id === "priceInCents"
                                          ? (e) => {
                                              if (
                                                e.target.value.startsWith("0")
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
                                      {priceInCents &&
                                      !isNaN(Number(priceInCents))
                                        ? formatCurrency(
                                            Number(priceInCents) / 100,
                                          )
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
                  )}
                </div>
              ))}
              {error && (
                <span className="max-w-sm whitespace-normal break-words text-destructive">
                  {error}
                </span>
              )}

              <DialogFooter>
                <div className="flex w-full flex-col items-center justify-center">
                  <SubmitButton
                    submitText={submitText}
                    editLoading={editLoading}
                    language={language}
                  />
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubmitButton({
  submitText,
  editLoading,
  language,
}: {
  submitText: string;
  editLoading: boolean;
  language: string;
}) {
  return (
    <Button
      type="submit"
      disabled={editLoading}
      className="mt-5 w-10/12 rounded-xl"
    >
      {editLoading
        ? language === "en"
          ? "Saving..."
          : "正在保存..."
        : submitText}
    </Button>
  );
}
