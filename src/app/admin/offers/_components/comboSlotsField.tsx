"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import {
  type Control,
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form";
import { type z } from "zod";

import { useLanguage } from "~/app/components/language";
import { type offerFormSchema } from "~/app/components/schemas";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { COMBO_MAX_SLOTS, COMBO_MIN_SLOTS } from "~/lib/offerPricing";

type OfferForm = z.infer<typeof offerFormSchema>;

type TargetKind = "dessert" | "category";

type NamedOption = { id: string; name: string; chineseName: string };

type ComboSlotsFieldProps = {
  control: Control<OfferForm>;
  desserts: NamedOption[];
  categories: NamedOption[];
};

/**
 * A combo's parts: the customer picks one dessert for each, in this order. A part is one
 * dessert, or a whole category to choose from - and two parts may name the same category
 * ("two sago bowls for $16"). Two to four of them.
 *
 * The rows carry no ids: the router replaces them on every save, since nothing outside the
 * offer keeps a part's id (the order server matches cart lines to parts as a set).
 */
export default function ComboSlotsField({
  control,
  desserts,
  categories,
}: ComboSlotsFieldProps) {
  const { language } = useLanguage();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "comboSlots",
  });
  const { setValue, trigger } = useFormContext<OfferForm>();
  const { errors, isSubmitted } = useFormState({ control, name: "comboSlots" });

  // The live values; `fields` holds those of the first render only.
  const slots = useWatch({ control, name: "comboSlots" });

  // Through `setValue` on the row's own fields, not the array's `update`, for the reason
  // the requirements field gives: `update` remounts the row on every pick.
  const setRow = (
    index: number,
    values: { dessertId: string | null; categoryId: string | null },
  ) => {
    const options = { shouldDirty: true };
    setValue(`comboSlots.${index}.dessertId`, values.dessertId, options);
    setValue(`comboSlots.${index}.categoryId`, values.categoryId, options);
    if (isSubmitted) void trigger("comboSlots");
  };

  /**
   * Which kind each row points at. Switching a row to "Category" clears its dessert, and a
   * row naming neither reads as a fresh dessert row, so the choice is remembered until a
   * target is picked - as in the requirements field.
   */
  const [kindOverrides, setKindOverrides] = useState<Record<string, TargetKind>>(
    {},
  );
  const kindOf = (fieldId: string, index: number): TargetKind =>
    kindOverrides[fieldId] ??
    (slots?.[index]?.dessertId != null ? "dessert" : "category");

  // A refusal that is no one row's - the count, or a dessert set on the offer itself.
  const listErrorMessage =
    errors.comboSlots?.root?.message ?? errors.comboSlots?.message;

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => {
        const row = slots?.[index];
        const kind = kindOf(field.id, index);
        const options = kind === "dessert" ? desserts : categories;
        const selected = kind === "dessert" ? row?.dessertId : row?.categoryId;
        const rowError = errors.comboSlots?.[index];
        const rowErrorMessage = rowError?.message ?? rowError?.root?.message;

        return (
          <div
            key={field.id}
            className="flex flex-wrap items-center gap-2 rounded-md border p-2"
          >
            <span className="w-14 text-sm font-medium">
              {language === "en" ? `Part ${index + 1}` : `第 ${index + 1} 项`}
            </span>

            <Select
              value={kind}
              onValueChange={(value) => {
                setKindOverrides((prev) => ({
                  ...prev,
                  [field.id]: value as TargetKind,
                }));
                setRow(index, { dessertId: null, categoryId: null });
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">
                  {language === "en" ? "Category" : "分类"}
                </SelectItem>
                <SelectItem value="dessert">
                  {language === "en" ? "Dessert" : "甜品"}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selected ?? undefined}
              onValueChange={(value) =>
                setRow(index, {
                  dessertId: kind === "dessert" ? value : null,
                  categoryId: kind === "category" ? value : null,
                })
              }
            >
              <SelectTrigger className="min-w-36 flex-1">
                <SelectValue
                  placeholder={language === "en" ? "Select…" : "请选择…"}
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {language === "en" ? option.name : option.chineseName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* type="button": inside a form the default is submit. */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={
                language === "en"
                  ? `Remove part ${index + 1}`
                  : `删除第 ${index + 1} 项`
              }
              disabled={fields.length <= COMBO_MIN_SLOTS}
              onClick={() => remove(index)}
            >
              <X className="h-4 w-4" />
            </Button>

            {rowErrorMessage && (
              <p className="w-full text-sm text-destructive">
                {language === "en"
                  ? "Pick a dessert or a category."
                  : "请选择一个甜品或分类。"}
              </p>
            )}
          </div>
        );
      })}

      {listErrorMessage && (
        <p className="text-sm text-destructive">
          {language === "en"
            ? `A combo has ${COMBO_MIN_SLOTS} to ${COMBO_MAX_SLOTS} parts, and names no dessert or category of its own.`
            : `套餐需包含 ${COMBO_MIN_SLOTS} 至 ${COMBO_MAX_SLOTS} 项，且不能另外指定甜品或分类。`}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {language === "en"
          ? "Customers pick one dessert for each part, in this order. A category part lets them choose any dessert in it, and two parts can use the same category. Extras cost their usual price on top."
          : "顾客按此顺序为每一项选择一款甜品。分类项可选择该分类中的任意甜品，两项可以使用同一分类。加料按原价另计。"}
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={fields.length >= COMBO_MAX_SLOTS}
        onClick={() => append({ dessertId: null, categoryId: null })}
      >
        <Plus className="mr-2 h-4 w-4" />
        {language === "en" ? "Add part" : "添加一项"}
      </Button>
    </div>
  );
}
