"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { useLanguage } from "~/app/components/language";
import { useId, useState } from "react";
import { useToast } from "~/hooks/use-toast";
import { Star } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const formSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email(),
    anonymous: z.boolean(),
    rating: z
      .number()
      .min(1, { message: "Please give us a star rating" })
      .max(5),
    feedbackMessage: z
      .string()
      .min(2, { message: "Please give us a proper feedback..." }),
  })
  .refine(
    (data) => {
      if (data.anonymous) {
        data.name = "";
      }
      return data.anonymous || (data.name && data.name.length >= 2);
    },
    {
      message: "Name must be at least 2 characters.",
      path: ["name"], // Attach the error to the 'name' field
    },
  );

const STARS = [1, 2, 3, 4, 5];

export default function FeedbackComponent() {
  const { language } = useLanguage();
  const en = language === "en";
  const [loading, setLoading] = useState(false);
  const ratingLabelId = useId();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      anonymous: false,
      email: "",
      rating: 0,
      feedbackMessage: "",
    },
  });

  const utils = api.useUtils();
  const createFeedback = api.feedback.create.useMutation({
    onSuccess: async () => {
      await utils.feedback.invalidate();
      setLoading(false);
      toast({
        title: language === "en" ? "Feedback sent!" : "反馈已发送!",
        description:
          language === "en" ? "Thanks for your feedback." : "感谢您的反馈。",
      });

      form.reset();
    },
    onError: () => {
      setLoading(false);
      toast({
        variant: "destructive",
        title: language === "en" ? "Something went wrong!" : "发生了一些错误!",
        description:
          language === "en" ? "Please try again later." : "请稍后再试。",
      });
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    await createFeedback.mutateAsync(values);
  }

  return (
    <div className="mx-auto w-full max-w-[600px] px-5 pb-12 pt-8 lg:pb-16 lg:pt-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.01em] lg:text-5xl">
          {en ? "Feedback" : "反馈"}
        </h1>
        <p className="text-base text-muted-foreground lg:text-lg">
          {en
            ? "We would love to hear your feedback!"
            : "我们很乐意听到您的反馈！"}
        </p>
      </header>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-[22px] pt-7"
        >
          <div className="flex flex-col gap-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem
                  className={cn(
                    "flex flex-col gap-2 space-y-0",
                    form.getValues().anonymous === true && "invisible",
                  )}
                >
                  <FormLabel variant="field">{en ? "Name" : "名字"}</FormLabel>
                  <FormControl>
                    <Input variant="field" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="anonymous"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <div className="flex min-h-11 items-center gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="h-6 w-6 rounded-[7px]"
                      />
                    </FormControl>
                    <FormLabel className="text-[15px] font-semibold">
                      {en ? "Anonymous" : "匿名"}
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 space-y-0">
                <FormLabel variant="field">
                  {en ? "Email" : "电子邮件"}
                </FormLabel>
                <FormControl>
                  <Input
                    variant="field"
                    autoComplete="email"
                    inputMode="email"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {en ? "This is your email." : "这是您的电子邮件。"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 space-y-0">
                {/* Names the group of stars, which a <label> cannot do. */}
                <span
                  id={ratingLabelId}
                  className="text-[15px] font-bold leading-snug"
                >
                  {en ? "Rating" : "评分"}
                </span>
                {/* Five radios, so arrow keys move between the stars as a screen reader
                    expects. Each star was a button named "1 stars" in either language. */}
                <FormControl>
                  <div
                    role="radiogroup"
                    aria-labelledby={ratingLabelId}
                    className="-ml-1.5 flex gap-0.5"
                  >
                    {STARS.map((star) => (
                      <label key={star} className="cursor-pointer">
                        <input
                          ref={star === 1 ? field.ref : undefined}
                          type="radio"
                          name={field.name}
                          value={star}
                          checked={field.value === star}
                          onChange={() => field.onChange(star)}
                          onBlur={field.onBlur}
                          className="peer sr-only"
                        />
                        <span className="flex h-12 w-12 items-center justify-center rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                          <Star
                            className={cn(
                              "h-8 w-8",
                              field.value >= star
                                ? "fill-accent text-accent"
                                : "text-input",
                            )}
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </span>
                        <span className="sr-only">
                          {en
                            ? `${star} ${star === 1 ? "star" : "stars"}`
                            : `${star} 星`}
                        </span>
                      </label>
                    ))}
                  </div>
                </FormControl>
                <FormDescription>
                  {en
                    ? "Rate your experience from 1 to 5 stars."
                    : "从1到5星评价您的体验。"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="feedbackMessage"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2 space-y-0">
                <FormLabel variant="field">
                  {en ? "Feedback message" : "反馈留言"}
                </FormLabel>
                <FormControl>
                  <Textarea
                    variant="field"
                    {...field}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto"; // Reset height to recalculate
                      target.style.height = `${target.scrollHeight}px`; // Set height to content
                    }}
                    className="min-h-32 resize-none overflow-hidden"
                  />
                </FormControl>
                <FormDescription>
                  {en ? "This is your message." : "这是您的反馈留言。"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            disabled={loading}
            type="submit"
            size="cta"
            className="mt-1 w-full"
          >
            {loading
              ? language === "en"
                ? "Submitting..."
                : "提交中..."
              : language === "en"
                ? "Submit"
                : "提交"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
