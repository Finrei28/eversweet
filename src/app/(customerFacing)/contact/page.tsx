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
            {language === "en"
              ? "You can contact us through our phone number: "
              : "您可以通过我们的电话号码与我们联系: "}
          </p>
        </section>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">
            {language === "en" ? "Our email" : "我们的电子邮件"}
          </h2>
          <p className="rounded-xl bg-secondary p-4">
            {language === "en"
              ? "You can contact us through our email: eversweet@eversweet.co.nz"
              : "您可以通过我们的电子邮件联系我们: eversweet@eversweet.co.nz"}
          </p>
        </section>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">
            {language === "en" ? "Our shop" : "我们的店"}
          </h2>
          <div className="rounded-xl bg-secondary p-4">
            <p>
              {language === "en"
                ? "You can come visit us at our shop and our friendly staff will be able to help you there."
                : "您可以来我们的商店参观，我们友好的员工将能够帮助您。"}
            </p>
            <p>
              {language === "en"
                ? " We are located at 5D/119 Meadowland Drive, Somerville, Auckland 2014."
                : "我们位于奥克兰2014年Somerville的5D/119 Meadowland Drive。"}
            </p>
          </div>
        </section>
      </MaxWidthWapper>
    </div>
  );
}
