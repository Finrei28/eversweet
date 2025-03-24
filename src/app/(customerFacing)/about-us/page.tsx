"use client";

import { useLanguage } from "~/app/components/language";
import MaxWidthWapper from "~/app/components/maxWidthWrapper";

export default function AboutUsPage() {
  const { language } = useLanguage();
  return (
    <div>
      <div className="mx-auto flex h-24 flex-col items-center justify-center bg-secondary">
        <h1 className="text-4xl">
          {language === "en" ? "About Eversweet" : "关于 Eversweet"}
        </h1>
      </div>
      <MaxWidthWapper>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">
            {language === "en" ? "Who We Are" : "我们是谁"}
          </h2>
          <p className="rounded-xl bg-secondary p-4">
            Eversweet is a dessert shop that specialises in chinese desserts and
            drinks.
          </p>
        </section>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">Our shop location</h2>
          <div className="rounded-xl bg-secondary p-4">
            <p>
              We are located at 5D/119 Meadowland Drive, Somerville, Auckland
              2014. Across the road on the left side of Countdown.
            </p>
            <p>(Same location as the old Tea Talk)</p>
          </div>
        </section>
        <section className="mt-10">
          <h2 className="ml-2 text-xl font-semibold">Our opening hours</h2>
          <p className="rounded-xl bg-secondary p-4">
            Owner still needs to decide.
          </p>
        </section>
      </MaxWidthWapper>
    </div>
  );
}
