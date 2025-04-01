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

const formSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email(),
    anonymous: z.boolean(),
    message: z
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
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      anonymous: false,
      email: "",
      message: "",
    },
  });

  // 2. Define a submit handler.
  function onSubmit(data: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    // console.log(data);
  }

  return (
    <div>
      <div className="mx-auto flex h-24 flex-col items-center justify-center bg-secondary">
        <h1 className="text-4xl">{language === "en" ? "Feedback" : "反馈"}</h1>
      </div>
      <MaxWidthWapper>
        <section className="mx-auto mt-10 max-w-xl">
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
                              defaultChecked={field.value}
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
                  name="message"
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
                <Button
                  type="submit"
                  className="mx-auto flex w-2/3 justify-center"
                >
                  {language === "en" ? "Submit" : "提交"}
                </Button>
              </form>
            </Form>
          </div>
        </section>
      </MaxWidthWapper>
    </div>
  );
}
