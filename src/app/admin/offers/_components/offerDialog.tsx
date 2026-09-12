"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { type z } from "zod";

import DateField from "~/app/components/dateField";
import { useLanguage } from "~/app/components/language";
import { createOfferSchema } from "~/app/components/schemas";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormInput,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";
import { type OfferRow } from "../columns";
import RequirementsField from "./requirementsField";

/**
 * One dialog for both create and edit, rather than the AddProduct/EditProduct pair the
 * products page uses.
 *
 * That pair duplicates roughly 250 lines for a form with seven fields. This form has
 * fourteen plus a field array, so two copies would be two places to forget a field.
 * The only real difference between the modes is which mutation runs and what the
 * defaults are, and both are one line.
 */

type OfferForm = z.infer<typeof createOfferSchema>;

type OfferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null means create. */
  offer: OfferRow | null;
};

const emptyOffer: OfferForm = {
  name: "",
  description: "",
  image: null,
  isActive: false,
  startsAt: null,
  endsAt: null,
  audience: "MEMBERS",
  dessertId: null,
  categoryId: null,
  itemPriceInCents: null,
  discountAmount: null,
  limit: 1,
  renewsWeekly: false,
  requirements: [],
};

const toFormValues = (offer: OfferRow | null): OfferForm =>
  offer
    ? {
        name: offer.name,
        description: offer.description ?? "",
        image: offer.image,
        isActive: offer.isActive,
        startsAt: offer.startsAt,
        endsAt: offer.endsAt,
        audience: offer.audience,
        dessertId: offer.dessert?.id ?? null,
        categoryId: offer.category?.id ?? null,
        itemPriceInCents: offer.itemPriceInCents,
        discountAmount: offer.discountAmount,
        limit: offer.limit,
        renewsWeekly: offer.renewsWeekly,
        requirements: offer.requirements.map((requirement) => ({
          id: requirement.id,
          dessertId: requirement.dessert?.id ?? null,
          categoryId: requirement.category?.id ?? null,
          quantity: requirement.quantity,
        })),
      }
    : emptyOffer;

export default function OfferDialog({
  open,
  onOpenChange,
  offer,
}: OfferDialogProps) {
  const { language } = useLanguage();
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [desserts] = api.dessert.getProducts.useSuspenseQuery();
  const [categories] = api.dessert.getCategories.useSuspenseQuery();

  const form = useForm<OfferForm>({
    resolver: zodResolver(createOfferSchema),
    defaultValues: toFormValues(offer),
  });

  const onError = (mutationError: { message: string }) => {
    setLoading(false);
    setError(mutationError.message);
  };

  const onSuccess = async (data: { name: string }) => {
    await utils.offer.invalidate();
    setLoading(false);
    onOpenChange(false);
    toast({
      title:
        language === "en"
          ? offer
            ? "Offer updated"
            : "Offer created"
          : offer
            ? "优惠已更新"
            : "优惠已创建",
      description:
        language === "en"
          ? `${data.name} has been saved. New offers start deactivated — activate one when it is ready to run.`
          : `${data.name} 已保存。新优惠默认为停用状态，准备好后再启用。`,
    });
  };

  const createOffer = api.offer.createOffer.useMutation({ onSuccess, onError });
  const updateOffer = api.offer.updateOffer.useMutation({ onSuccess, onError });

  // Reload the form whenever a different offer is opened; without this the dialog
  // keeps the previous row's values.
  useEffect(() => {
    if (open) {
      form.reset(toFormValues(offer));
      setImagePreview(offer?.image ?? null);
      setError(null);
      setLoading(false);
    }
  }, [open, offer, form]);

  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) {
      form.clearErrors();
      setError(null);
      setLoading(false);
    }
    prevOpen.current = open;
  }, [open, form]);

  const handleImage = async (file: File) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch(`/admin/products/api/uploadImage`, {
      method: "POST",
      body: formData,
    });
    const result = (await res.json()) as {
      imagePath?: string;
      error?: string;
    };

    setLoading(false);

    if (!res.ok || !result.imagePath) {
      setError(result.error ?? "Failed to upload image");
      return;
    }

    form.setValue("image", result.imagePath);
    setImagePreview(result.imagePath);
  };

  const handleSubmit = (data: OfferForm) => {
    setLoading(true);
    setError(null);

    if (offer) {
      updateOffer.mutate({ offer: { ...data, id: offer.id } });
    } else {
      createOffer.mutate({ offer: data });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {offer
              ? language === "en"
                ? "Edit offer"
                : "编辑优惠"
              : language === "en"
                ? "New offer"
                : "新增优惠"}
          </DialogTitle>
          <DialogDescription>
            {language === "en"
              ? "Offers are served to the customer app. Editing one never changes who has already redeemed it."
              : "优惠会显示在顾客应用中。编辑优惠不会影响已兑换的记录。"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pb-2 pt-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <div>
                  <FormLabel>{language === "en" ? "Name" : "名称"}</FormLabel>
                  <FormControl>
                    <FormInput {...field} />
                  </FormControl>
                  <FormMessage />
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <div>
                  <FormLabel>
                    {language === "en" ? "Description" : "描述"}
                  </FormLabel>
                  <FormControl>
                    <Textarea className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </div>
              )}
            />

            <div>
              <FormLabel>{language === "en" ? "Image" : "图片"}</FormLabel>
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImage(file);
                }}
              />
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt=""
                  className="mt-2 h-20 w-20 rounded object-cover"
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="audience"
              render={({ field }) => (
                <div>
                  <FormLabel>
                    {language === "en" ? "Audience" : "对象"}
                  </FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBERS">
                        {language === "en" ? "Members" : "会员"}
                      </SelectItem>
                      <SelectItem value="EVERYONE">
                        {language === "en" ? "Everyone" : "所有人"}
                      </SelectItem>
                      <SelectItem value="NEW_USERS">
                        {language === "en" ? "New users" : "新用户"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </div>
              )}
            />

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="dessertId"
                render={({ field }) => (
                  <div>
                    <FormLabel>
                      {language === "en" ? "Dessert" : "甜品"}
                    </FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => {
                        field.onChange(value === "none" ? null : value);
                        if (value !== "none") form.setValue("categoryId", null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {language === "en" ? "None" : "无"}
                        </SelectItem>
                        {desserts.map((dessert) => (
                          <SelectItem key={dessert.id} value={dessert.id}>
                            {language === "en"
                              ? dessert.name
                              : dessert.chineseName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <div>
                    <FormLabel>
                      {language === "en" ? "Category" : "分类"}
                    </FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => {
                        field.onChange(value === "none" ? null : value);
                        if (value !== "none") form.setValue("dessertId", null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {language === "en" ? "None" : "无"}
                        </SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {language === "en"
                              ? category.name
                              : category.chineseName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="itemPriceInCents"
                render={({ field }) => (
                  <div>
                    <FormLabel>
                      {language === "en"
                        ? "Fixed price (cents)"
                        : "固定价格(分)"}
                    </FormLabel>
                    <FormControl>
                      <FormInput
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="discountAmount"
                render={({ field }) => (
                  <div>
                    <FormLabel>
                      {language === "en" ? "Discount (%)" : "折扣(%)"}
                    </FormLabel>
                    <FormControl>
                      <FormInput
                        type="number"
                        min={0}
                        max={100}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </div>
                )}
              />
            </div>

            {/* Not a validation rule: a stricter check than the column itself would stop
                an offer that is running right now from loading into its own form. */}
            {form.watch("itemPriceInCents") !== null &&
              form.watch("discountAmount") !== null && (
                <p className="text-sm text-muted-foreground">
                  {language === "en"
                    ? "A fixed price overrides the discount — the discount will be ignored."
                    : "设置固定价格后将忽略折扣。"}
                </p>
              )}

            <FormField
              control={form.control}
              name="limit"
              render={({ field }) => (
                <div>
                  <FormLabel>
                    {language === "en"
                      ? "Uses per customer"
                      : "每位顾客可用次数"}
                  </FormLabel>
                  <FormControl>
                    <FormInput
                      type="number"
                      min={1}
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value))
                      }
                    />
                  </FormControl>
                  {/* The order server marks a redemption REDEEMED on first use and then
                      refuses any further one while the offer has requirements, so the
                      number here has no effect on a gated offer. Being fixed there - see
                      OUTSTANDING.md - but say so rather than let it look like it works. */}
                  {form.watch("requirements").length > 0 && field.value > 1 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {language === "en"
                        ? "Offers with requirements can currently only be used once, whatever this says."
                        : "设有解锁条件的优惠目前每位顾客只能使用一次。"}
                    </p>
                  )}
                  <FormMessage />
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="renewsWeekly"
              render={({ field }) => (
                <div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange.bind(field)}
                    />
                    <FormLabel>
                      {language === "en" ? "Renews weekly" : "每周重置"}
                    </FormLabel>
                  </div>
                  {/* Sits under the limit because that is what it modifies: with this on,
                      the number above is an allowance per week rather than per run. */}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {language === "en"
                      ? "Clears each customer's usage every Monday, so the limit above is per week rather than for the whole run. Leave off for a one-off offer."
                      : "每周一清除每位顾客的使用次数，上方的次数即为每周可用次数，而非整轮活动。一次性优惠请勿勾选。"}
                  </p>
                  <FormMessage />
                </div>
              )}
            />

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <div>
                    <FormLabel>
                      {language === "en" ? "Starts" : "开始"}
                    </FormLabel>
                    <DateField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={
                        language === "en" ? "No start" : "无开始日期"
                      }
                    />
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <div>
                    <FormLabel>{language === "en" ? "Ends" : "结束"}</FormLabel>
                    <DateField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={language === "en" ? "No end" : "无结束日期"}
                    />
                  </div>
                )}
              />
            </div>

            <div>
              <FormLabel>
                {language === "en" ? "Requirements" : "解锁条件"}
              </FormLabel>
              <div className="mt-2">
                <RequirementsField
                  control={form.control}
                  desserts={desserts}
                  categories={categories}
                />
              </div>
            </div>

            {/* Switching an offer on is done from the row menu, where it is confirmed
                and where the redemption reset is explained. This is only here so an
                already-live offer does not get quietly paused by an edit. */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange.bind(field)}
                  />
                  <FormLabel>
                    {language === "en" ? "Active" : "启用中"}
                  </FormLabel>
                </div>
              )}
            />

            {error && (
              <span className="flex flex-col items-center justify-center text-destructive">
                {error}
              </span>
            )}

            <DialogFooter>
              <div className="flex w-full flex-col items-center justify-center">
                <Button disabled={loading} className="mt-5 w-10/12 rounded-xl">
                  {loading
                    ? language === "en"
                      ? "Submitting..."
                      : "正在提交..."
                    : language === "en"
                      ? "Save offer"
                      : "保存优惠"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
