"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { useLanguage } from "~/app/components/language";
import { shopProfileSchema } from "~/app/components/schemas";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";

type ShopProfileForm = z.infer<typeof shopProfileSchema>;

const FIELDS: {
  name: Exclude<keyof ShopProfileForm, "about">;
  en: string;
  zh: string;
}[] = [
  { name: "name", en: "Shop name", zh: "店名" },
  { name: "address", en: "Street address", zh: "街道地址" },
  { name: "city", en: "City", zh: "城市" },
  { name: "state", en: "Region", zh: "地区" },
  { name: "postal", en: "Postcode", zh: "邮政编码" },
  { name: "phone", en: "Phone", zh: "电话" },
  { name: "email", en: "Email", zh: "电子邮件" },
  { name: "website", en: "Website", zh: "网站" },
];

/**
 * The shop's own details, read by the customer app's store screen and by this site's
 * contact page and structured data.
 *
 * These were written out in five places across the two repos, in two different formats. The
 * staff app's printed receipt is the one copy that still has its own: it prints over
 * Bluetooth with no network, so it keeps a baked-in default and uses these when it has
 * them.
 */
export function ShopProfileCard() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const utils = api.useUtils();

  const [profile] = api.settings.getShopProfile.useSuspenseQuery();

  const form = useForm<ShopProfileForm>({
    resolver: zodResolver(shopProfileSchema),
    // Null until the shop writes one; the textarea edits a string.
    values: { ...profile, about: profile.about ?? "" },
  });

  const { mutate, isPending } = api.settings.saveShopProfile.useMutation({
    onSuccess: async () => {
      await utils.settings.invalidate();
      toast({ title: language === "en" ? "Details saved" : "已保存" });
    },
    onError: (error) =>
      toast({ variant: "destructive", description: error.message }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {language === "en" ? "Shop details" : "店铺信息"}
        </CardTitle>
        <CardDescription>
          {language === "en"
            ? "Shown on the app's store screen and this site's contact page."
            : "显示在应用程序的店铺页面和本网站的联系页面上。"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutate(values))}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.map(({ name, en, zh }) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "en" ? en : zh}</FormLabel>
                      <FormControl>
                        <FormInput {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            {/* The app's "About Eversweet" paragraph, which was written into the app and
                could not be changed from here (the app's TODO item 8, entry 11). */}
            <FormField
              control={form.control}
              name="about"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {language === "en" ? "About the shop" : "关于本店"}
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormDescription>
                    {language === "en"
                      ? "Shown under \"About Eversweet\" on the app's store screen. Empty shows the app's own text."
                      : "显示在应用程序店铺页面的“关于永玖甜”下。留空则显示应用程序自带的文字。"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isPending || !form.formState.isDirty}
            >
              {isPending
                ? language === "en"
                  ? "Saving..."
                  : "保存中..."
                : language === "en"
                  ? "Save"
                  : "保存"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
