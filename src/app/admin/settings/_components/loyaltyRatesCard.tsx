"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { useLanguage } from "~/app/components/language";
import { loyaltyRatesSchema } from "~/app/components/schemas";
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
import { useToast } from "~/hooks/use-toast";
import { asMultiplier } from "~/lib/shopSettings";
import { api } from "~/trpc/react";

type LoyaltyRatesForm = z.infer<typeof loyaltyRatesSchema>;

/**
 * What an order earns in Sweet Points.
 *
 * Stored and edited as whole numbers. The order server divides by 100 when it serves them,
 * so this screen never shows a fraction and a rate cannot be saved as one - which is the
 * shape of the bug that made an offer's Decimal discount price a 20% offer at -19x list.
 */
export function LoyaltyRatesCard() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const utils = api.useUtils();

  const [rates] = api.settings.getLoyaltyRates.useSuspenseQuery();

  const form = useForm<LoyaltyRatesForm>({
    resolver: zodResolver(loyaltyRatesSchema),
    values: rates,
  });

  const { mutate, isPending } = api.settings.saveLoyaltyRates.useMutation({
    onSuccess: async () => {
      await utils.settings.invalidate();
      toast({
        title: language === "en" ? "Rates saved" : "已保存",
        description:
          language === "en"
            ? "The app will pick this up within a minute."
            : "应用程序将在一分钟内更新。",
      });
    },
    onError: (error) =>
      toast({ variant: "destructive", description: error.message }),
  });

  // What a member actually gets, shown while the admin types, because the benefits list
  // below is free text and spent months advertising 2x against a 1.5x rate.
  const memberMultiplier = asMultiplier(
    Number(form.watch("memberBonusPercent")) || 0,
  );
  const everyoneMultiplier = asMultiplier(
    Number(form.watch("modifierPercent")) || 0,
  );
  const pointsPerDollar = Number(form.watch("pointsPerDollar")) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {language === "en" ? "Loyalty points" : "积分"}
        </CardTitle>
        <CardDescription>
          {language === "en"
            ? "What an app order earns. Website orders earn nothing, whatever these say."
            : "应用程序订单的积分。无论如何设置，网站订单都不会获得积分。"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutate(values))}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="pointsPerDollar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === "en"
                        ? "Points per dollar"
                        : "每元积分"}
                    </FormLabel>
                    <FormControl>
                      <FormInput type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="memberBonusPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === "en"
                        ? "Member bonus (%)"
                        : "会员加成 (%)"}
                    </FormLabel>
                    <FormControl>
                      <FormInput type="number" {...field} />
                    </FormControl>
                    <FormDescription>
                      {language === "en"
                        ? `150 means members earn ${memberMultiplier}x.`
                        : `150 表示会员获得 ${memberMultiplier} 倍积分。`}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modifierPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === "en"
                        ? "Promotion (%)"
                        : "促销 (%)"}
                    </FormLabel>
                    <FormControl>
                      <FormInput type="number" {...field} />
                    </FormControl>
                    <FormDescription>
                      {language === "en"
                        ? "200 is a double-points weekend. 100 is normal."
                        : "200 表示双倍积分，100 为正常。"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <p className="rounded-md bg-muted p-3 text-sm">
              {language === "en" ? (
                <>
                  A $10 order earns{" "}
                  <strong>
                    {Math.floor(10 * pointsPerDollar * everyoneMultiplier)}
                  </strong>{" "}
                  points, or{" "}
                  <strong>
                    {Math.floor(
                      10 *
                        pointsPerDollar *
                        everyoneMultiplier *
                        memberMultiplier,
                    )}
                  </strong>{" "}
                  for a member.
                </>
              ) : (
                <>
                  10 元订单可获得{" "}
                  <strong>
                    {Math.floor(10 * pointsPerDollar * everyoneMultiplier)}
                  </strong>{" "}
                  积分，会员可获得{" "}
                  <strong>
                    {Math.floor(
                      10 *
                        pointsPerDollar *
                        everyoneMultiplier *
                        memberMultiplier,
                    )}
                  </strong>{" "}
                  积分。
                </>
              )}
            </p>

            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
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
