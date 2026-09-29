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
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type OfferForm = z.infer<typeof offerFormSchema>;

type TargetKind = "dessert" | "category";

type NamedOption = { id: string; name: string; chineseName: string };

type RequirementsFieldProps = {
  control: Control<OfferForm>;
  desserts: NamedOption[];
  categories: NamedOption[];
};

/**
 * What a customer has to buy before the offer unlocks - so many of a dessert, or so
 * many from a category.
 *
 * Each row carries its persisted `id` through the form untouched so the update mutation
 * can patch the row rather than delete and recreate it. Rows added here have no id,
 * which is exactly how the server tells new from existing.
 */
export default function RequirementsField({
  control,
  desserts,
  categories,
}: RequirementsFieldProps) {
  const { language } = useLanguage();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "requirements",
  });
  const { setValue, trigger } = useFormContext<OfferForm>();
  const { errors, isSubmitted } = useFormState({
    control,
    name: "requirements",
  });

  // The live array values. `fields` holds the values from first render only, so reading
  // the current selection back out of it would show stale ids after an edit.
  const requirements = useWatch({ control, name: "requirements" });

  /**
   * Edits go through `setValue` on the row's own fields, never the field array's
   * `update`. `update` gives the row a new `field.id`, which is its React key and the
   * key of `kindOverrides`: every pick remounted the row, the quantity box lost focus
   * after each keystroke, and switching to "Category" forgot the switch at once and
   * snapped back to "Dessert" - the whole row looked unresponsive.
   */
  const setRow = (
    index: number,
    values: {
      dessertId?: string | null;
      categoryId?: string | null;
      quantity?: number;
    },
  ) => {
    const options = { shouldDirty: true };
    if (values.dessertId !== undefined)
      setValue(`requirements.${index}.dessertId`, values.dessertId, options);
    if (values.categoryId !== undefined)
      setValue(`requirements.${index}.categoryId`, values.categoryId, options);
    if (values.quantity !== undefined)
      setValue(`requirements.${index}.quantity`, values.quantity, options);
    // Once a save has been refused, re-check as the admin fixes the rows, so the
    // message clears when the row is complete rather than on the next save.
    if (isSubmitted) void trigger("requirements");
  };

  /**
   * Which kind of target each row is pointing at.
   *
   * Inferring this from the data alone does not work: switching to "category" has to
   * clear dessertId, and a row with neither id set is indistinguishable from a fresh
   * dessert row - so the picker would snap back to "Dessert" the moment it was
   * switched. The override remembers the choice until a target is actually picked.
   * Keyed by the field id, which useFieldArray keeps stable across reorders.
   */
  const [kindOverrides, setKindOverrides] = useState<
    Record<string, TargetKind>
  >({});

  return (
    <div className="flex flex-col gap-2">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {language === "en"
            ? "No requirements — the offer unlocks without a qualifying purchase."
            : "没有条件 — 无需购买即可解锁优惠。"}
        </p>
      )}

      {fields.map((field, index) => {
        const row = requirements?.[index];
        const kind: TargetKind =
          kindOverrides[field.id] ??
          (row?.categoryId != null ? "category" : "dessert");
        const options = kind === "dessert" ? desserts : categories;
        const selected = kind === "dessert" ? row?.dessertId : row?.categoryId;
        // The schema's refine is on the row, not a field, so zod reports it at the row's
        // own path. Nothing showed it, and Save on a row with nothing picked did nothing.
        const rowError = errors.requirements?.[index];
        const rowErrorMessage = rowError?.message ?? rowError?.root?.message;

        return (
          <div
            key={field.id}
            className="flex flex-wrap items-center gap-2 rounded-md border p-2"
          >
            <Select
              value={kind}
              onValueChange={(value) => {
                setKindOverrides((prev) => ({
                  ...prev,
                  [field.id]: value as TargetKind,
                }));
                // A dessert id is meaningless in the category column, and the schema
                // refines that exactly one of the two is set.
                setRow(index, { dessertId: null, categoryId: null });
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dessert">
                  {language === "en" ? "Dessert" : "甜品"}
                </SelectItem>
                <SelectItem value="category">
                  {language === "en" ? "Category" : "分类"}
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

            <Input
              type="number"
              min={1}
              className="w-20"
              value={row?.quantity ?? 1}
              onChange={(event) =>
                setRow(index, { quantity: Number(event.target.value) })
              }
            />

            {/* type="button" on every one of these: inside a form the default is submit. */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
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

      {/* The rules the order server's unlock applies, which nothing here said. Offer
          descriptions are free text, so an admin writing "Buy any 4 Mochi Bowls…" had no way
          to know that four across two orders, or four paid with points, unlock nothing. The
          Terms (section 15) and the app's hint say the same. */}
      {fields.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {language === "en"
            ? "Customers unlock this offer by ordering everything above in one app order, paid at least partly by card. An order paid only with Sweet Points does not count, and nor do items from another offer. One item can count towards more than one line."
            : "顾客需在同一笔应用程序订单中购买以上全部商品，并至少部分以银行卡付款，才能解锁此优惠。仅用积分支付的订单不计入，其他优惠中的商品也不计入。同一件商品可同时计入多行条件。"}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({ dessertId: null, categoryId: null, quantity: 1 })
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        {language === "en" ? "Add requirement" : "添加条件"}
      </Button>
    </div>
  );
}
