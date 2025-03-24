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

const formSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: "Username must be at least 2 characters.",
    })
    .optional(),
  email: z.string().email(),
  anonymous: z.boolean().optional(),
  message: z
    .string()
    .min(2, { message: "Please give us a proper feedback..." }),
});

export default function FeedbackPage() {
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
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values);
  }

  return (
    <div>
      <div className="mx-auto flex h-24 flex-col items-center justify-center bg-secondary">
        <h1 className="text-4xl">Feedback</h1>
      </div>
      <MaxWidthWapper>
        <section className="mx-auto mt-10 max-w-xl">
          <h2 className="text-xl font-semibold">
            We would love to hear your feedback!
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
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="name" {...field} />
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
                          <FormLabel className="ml-2">Anonymous</FormLabel>
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name" {...field} />
                      </FormControl>
                      <FormDescription>This is your email.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feedback message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="message"
                          {...field}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = "auto"; // Reset height to recalculate
                            target.style.height = `${target.scrollHeight}px`; // Set height to content
                          }}
                          className="resize-none overflow-hidden"
                        />
                      </FormControl>
                      <FormDescription>This is your message.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="mx-auto flex w-2/3 justify-center"
                >
                  Submit
                </Button>
              </form>
            </Form>
          </div>
        </section>
      </MaxWidthWapper>
    </div>
  );
}
