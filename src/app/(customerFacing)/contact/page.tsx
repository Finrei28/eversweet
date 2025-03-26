"use client";
import { useLanguage } from "~/app/components/language";
import MaxWidthWapper from "~/app/components/maxWidthWrapper";

export default function ContactPage() {
  const { language } = useLanguage();
  return (
    <div className="">
      <div className="mx-auto flex h-24 flex-col items-center justify-center bg-secondary">
        <h1 className="text-4xl">
          {language === "en" ? "Contact" : "联系方法"}
        </h1>
      </div>
      <MaxWidthWapper>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">
            {language === "en" ? "Our phone number" : "我们的电话号码"}
          </h2>
          <p className="rounded-xl bg-secondary p-4">
            Phone number not set up yet...
          </p>
        </section>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">
            {language === "en" ? "Our email" : "我们的电子邮件"}
          </h2>
          <p className="rounded-xl bg-secondary p-4">
            You can contact us through our email: eversweet@eversweet.co.nz
          </p>
        </section>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">
            {language === "en" ? "Our shop" : "我们的店"}
          </h2>
          <div className="rounded-xl bg-secondary p-4">
            <p>
              You can come visit us at our shop and our friendly staff will be
              able to help you there.
            </p>
            <p>
              We are located at 5D/119 Meadowland Drive, Somerville, Auckland
              2014.
            </p>
          </div>
        </section>
      </MaxWidthWapper>
    </div>
  );
}
