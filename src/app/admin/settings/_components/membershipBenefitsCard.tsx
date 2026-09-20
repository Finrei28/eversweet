"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";

import { useLanguage } from "~/app/components/language";
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
  FormField,
  FormInput,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import { useToast } from "~/hooks/use-toast";
import {
  BENEFIT_MAX_LENGTH,
  MEMBER_RATE_TOKEN,
  benefitsClaimingOtherMultiplier,
  previewBenefit,
} from "~/lib/shopSettings";
import { api } from "~/trpc/react";
import { z } from "zod";

/**
 * The form's own shape. The router's `membershipBenefitsSchema` drops blank rows before
 * checking the list is non-empty, which is right for the wire but wrong for a form: an
 * admin clearing a field to retype it would see the whole list rejected mid-edit. So the
 * form allows blanks and they are filtered on submit.
 */
const benefitsFormSchema = z.object({
  benefits: z.array(
    z.object({ value: z.string().trim().max(BENEFIT_MAX_LENGTH) }),
  ),
});

type BenefitsForm = z.infer<typeof benefitsFormSchema>;

/**
 * What the app lists on the join and manage screens, in order.
 *
 * Free text, so nothing can stop a benefit claiming something the rows do not do. The
 * hardcoded list advertised "Earn 2x loyalty points" for months while the rate gave members
 * 1.5x, which is why this screen checks the wording against the live multiplier and says so
 * rather than trusting it.
 */
export function MembershipBenefitsCard() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const utils = api.useUtils();

  const [plan] = api.settings.getMembershipBenefits.useSuspenseQuery();
  const [warnings] = api.settings.getSettingsWarnings.useSuspenseQuery({});

  const form = useForm<BenefitsForm>({
    resolver: zodResolver(benefitsFormSchema),
    values: { benefits: plan.benefits.map((value) => ({ value })) },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "benefits",
  });

  /**
   * Checked against what is currently typed, not against what is saved.
   *
   * The warning used to come from the server, which could only see the rows already in the
   * database - so an admin could type "2x loyalty points" over a 1.5x rate, save it, and
   * only be told once customers could already read it. `memberMultiplier` still comes from
   * the server because that is the live rate; the claim is judged here.
   */
  const typed = form.watch("benefits").map((b) => b.value);
  const claims = benefitsClaimingOtherMultiplier(
    typed,
    warnings.memberMultiplier,
  );

  const { mutate, isPending } = api.settings.saveMembershipBenefits.useMutation({
    onSuccess: async () => {
      await utils.settings.invalidate();
      toast({
        title: language === "en" ? "Benefits saved" : "已保存",
      });
    },
    onError: (error) =>
      toast({ variant: "destructive", description: error.message }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {language === "en" ? "Membership benefits" : "会员权益"}
        </CardTitle>
        <CardDescription>
          {language === "en"
            ? `Shown on the app's join screen, in this order. Write ${MEMBER_RATE_TOKEN} for the member points multiplier and it will always match the rate.`
            : `按此顺序显示在应用程序的加入页面上。使用 ${MEMBER_RATE_TOKEN} 表示会员积分倍数，即可始终与费率保持一致。`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {claims.length > 0 && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            {language === "en" ? (
              <>
                Members currently earn{" "}
                <strong>{warnings.memberMultiplier}x</strong> points, but a
                benefit says otherwise:
              </>
            ) : (
              <>
                会员目前获得 <strong>{warnings.memberMultiplier}</strong>{" "}
                倍积分，但以下权益描述不符：
              </>
            )}
            <ul className="mt-1 list-inside list-disc">
              {claims.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <p className="mt-2">
              {language === "en" ? (
                <>
                  Write <code>{MEMBER_RATE_TOKEN}</code> instead of the number and
                  it will always match the rate.
                </>
              ) : (
                <>
                  使用 <code>{MEMBER_RATE_TOKEN}</code> 代替数字，即可始终与费率保持一致。
                </>
              )}
            </p>
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              mutate({ benefits: values.benefits.map((b) => b.value) }),
            )}
            className="space-y-3"
          >
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <FormField
                  control={form.control}
                  name={`benefits.${index}.value`}
                  render={({ field: input }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <FormInput
                          {...input}
                          placeholder={
                            language === "en"
                              ? "e.g. Cancel anytime"
                              : "例如：随时取消"
                          }
                        />
                      </FormControl>
                      {/* What the app will actually print, so the token is not a guess. */}
                      {input.value?.includes(MEMBER_RATE_TOKEN) && (
                        <p className="text-xs text-muted-foreground">
                          {language === "en" ? "Shows as: " : "显示为："}
                          {previewBenefit(input.value, warnings.memberMultiplier)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => remove(index)}
                  aria-label={language === "en" ? "Remove" : "删除"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {form.formState.errors.benefits?.root && (
              <p className="text-sm text-destructive">
                {form.formState.errors.benefits.root.message}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ value: "" })}
              >
                {language === "en" ? "Add a benefit" : "添加权益"}
              </Button>
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
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
