"use client";

import MaxWidthWapper from "~/app/components/maxWidthWrapper";
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
import { useState } from "react";
import { useToast } from "~/hooks/use-toast";
import { Star } from "lucide-react";
import { api } from "~/trpc/react";
import { motion } from "framer-motion";
import Image from "next/image";

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

export default function FeedbackPage() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
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
    <div className="min-h-screen bg-gradient-to-b from-background to-white">
      {/* Hero section with background image */}
      <div className="relative h-64 w-full overflow-hidden bg-background sm:h-80">
        <div className="absolute inset-0 bg-gradient-to-r from-secondary to-primary" />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
          <motion.h1
            className="font-serif text-4xl font-bold text-black sm:text-5xl md:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {language === "en" ? "Feedback" : "反馈"}
          </motion.h1>
          <motion.p
            className="mt-4 max-w-md text-lg text-gray-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {language === "en"
              ? "We would love to hear your feedback!"
              : "我们很乐意听到您的反馈！"}
          </motion.p>
        </div>
      </div>
      <MaxWidthWapper>
        <section className="mx-auto max-w-xl py-20">
          <h2 className="text-xl font-semibold">
            {language === "en"
              ? "We would love to hear your feedback!"
              : "我们很乐意听到您的反馈！"}
          </h2>
          <div className="rounded-xl pt-10">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem
                        className={`${form.getValues().anonymous === true ? "invisible" : ""}`}
                      >
                        <FormLabel>
                          {language === "en" ? "Name" : "名字"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={language === "en" ? "Name" : "名字"}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="anonymous"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="ml-2">
                            {language === "en" ? "Anonymous" : "匿名"}
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
                    <FormItem>
                      <FormLabel>
                        {language === "en" ? "Email" : "电子邮件"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={language === "en" ? "Email" : "电子邮件"}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {language === "en"
                          ? "This is your email."
                          : "这是您的电子邮件"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {language === "en" ? "Rating" : "评分"}
                      </FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => field.onChange(star)}
                              className="focus:outline-none"
                              aria-label={`${star} stars`}
                            >
                              <Star
                                className={`h-8 w-8 transition-all ${
                                  field.value >= star
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      <FormDescription>
                        {language === "en"
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
                    <FormItem>
                      <FormLabel>
                        {language === "en" ? "Feedback message" : "反馈留言"}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={
                            language === "en" ? "Feedback message" : "反馈留言"
                          }
                          {...field}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = "auto"; // Reset height to recalculate
                            target.style.height = `${target.scrollHeight}px`; // Set height to content
                          }}
                          className="resize-none overflow-hidden"
                        />
                      </FormControl>
                      <FormDescription>
                        {language === "en"
                          ? "This is your message."
                          : "这是您的反馈留言"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button disabled={loading} type="submit">
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
        </section>
      </MaxWidthWapper>
    </div>
  );
}
