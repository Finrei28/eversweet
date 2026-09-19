"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import DateField from "~/app/components/dateField";
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
  FormDescription,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/hooks/use-toast";
import { pickedDay } from "~/lib/aucklandDay";
import {
  ANNOUNCEMENT_TEXT_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  MAX_ACTIVE_ANNOUNCEMENTS,
} from "~/lib/shopSettings";
import { api } from "~/trpc/react";

/**
 * The form holds the date as the calendar's `Date`, and `pickedDay` turns it into the day
 * the admin saw on submit. Reading the day on the server instead is a day early on Vercel,
 * which runs in UTC - the bug that made every offer end a day too soon.
 */
const announcementFormSchema = z.object({
  announcements: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().trim().min(1).max(ANNOUNCEMENT_TITLE_MAX_LENGTH),
      text1: z.string().trim().min(1).max(ANNOUNCEMENT_TEXT_MAX_LENGTH),
      text2: z.string().trim().max(ANNOUNCEMENT_TEXT_MAX_LENGTH).optional(),
      isActive: z.boolean(),
      publishedAt: z.date(),
    }),
  ),
});

type AnnouncementsForm = z.infer<typeof announcementFormSchema>;

/**
 * The messages the app shows in its launch pop-up.
 *
 * The date is what the app compares against the last announcement it showed, so moving it
 * forward is how an announcement is put back in front of everyone who has already dismissed
 * one. Leaving it alone while fixing a typo is the point of it being separate from the
 * row's own updatedAt.
 */
export function AnnouncementsCard() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const utils = api.useUtils();

  const [announcements] = api.settings.getAnnouncements.useSuspenseQuery();

  const form = useForm<AnnouncementsForm>({
    resolver: zodResolver(announcementFormSchema),
    values: {
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        text1: a.text1,
        text2: a.text2 ?? "",
        isActive: a.isActive,
        publishedAt: a.publishedAt,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "announcements",
  });

  const { mutate, isPending } = api.settings.saveAnnouncements.useMutation({
    onSuccess: async () => {
      await utils.settings.invalidate();
      toast({ title: language === "en" ? "Announcements saved" : "已保存" });
    },
    onError: (error) =>
      toast({ variant: "destructive", description: error.message }),
  });

  const showing = form
    .watch("announcements")
    .filter((a) => a.isActive).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {language === "en" ? "Announcements" : "公告"}
        </CardTitle>
        <CardDescription>
          {language === "en"
            ? `Shown in the app's pop-up when it opens. ${showing} of ${MAX_ACTIVE_ANNOUNCEMENTS} showing.`
            : `在应用程序打开时弹出显示。正在显示 ${showing} / ${MAX_ACTIVE_ANNOUNCEMENTS}。`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              mutate({
                announcements: values.announcements.map((a) => ({
                  id: a.id,
                  title: a.title,
                  text1: a.text1,
                  text2: a.text2?.length ? a.text2 : undefined,
                  isActive: a.isActive,
                  publishedOn: pickedDay(a.publishedAt),
                })),
              }),
            )}
            className="space-y-4"
          >
            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {language === "en"
                  ? "No announcements. The app shows no pop-up."
                  : "没有公告，应用程序不会显示弹窗。"}
              </p>
            )}

            {fields.map((field, index) => (
              <div key={field.id} className="space-y-3 rounded-md border p-4">
                <div className="flex items-start gap-2">
                  <FormField
                    control={form.control}
                    name={`announcements.${index}.title`}
                    render={({ field: input }) => (
                      <FormItem className="flex-1">
                        <FormLabel>
                          {language === "en" ? "Title" : "标题"}
                        </FormLabel>
                        <FormControl>
                          <FormInput {...input} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-8"
                    onClick={() => remove(index)}
                    aria-label={language === "en" ? "Remove" : "删除"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name={`announcements.${index}.text1`}
                  render={({ field: input }) => (
                    <FormItem>
                      <FormLabel>
                        {language === "en" ? "Message" : "内容"}
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...input} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`announcements.${index}.text2`}
                  render={({ field: input }) => (
                    <FormItem>
                      <FormLabel>
                        {language === "en"
                          ? "Second paragraph (optional)"
                          : "第二段（可选）"}
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...input} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap items-end gap-6">
                  <FormField
                    control={form.control}
                    name={`announcements.${index}.publishedAt`}
                    render={({ field: input }) => (
                      <FormItem>
                        <FormLabel>
                          {language === "en" ? "Dated" : "日期"}
                        </FormLabel>
                        <DateField
                          value={input.value}
                          onChange={(date) => date && input.onChange(date)}
                          placeholder={
                            language === "en" ? "Pick a date" : "选择日期"
                          }
                        />
                        <FormDescription>
                          {language === "en"
                            ? "Move this forward to show it again to everyone."
                            : "向后调整日期可再次向所有人显示。"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`announcements.${index}.isActive`}
                    render={({ field: input }) => (
                      <FormItem className="flex items-center gap-2 pb-2">
                        <FormControl>
                          <Switch
                            checked={input.value}
                            onCheckedChange={input.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">
                          {language === "en" ? "Showing" : "显示中"}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({
                    title: "",
                    text1: "",
                    text2: "",
                    isActive: true,
                    publishedAt: new Date(),
                  })
                }
              >
                {language === "en" ? "Add an announcement" : "添加公告"}
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
