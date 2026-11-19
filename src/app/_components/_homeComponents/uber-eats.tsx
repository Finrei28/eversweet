"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useLanguage } from "../../components/language";

const UBER_EATS_STORE =
  "https://www.ubereats.com/nz/store/eversweet/cdSuxGsZSUSGotTxyjfrvQ?srsltid=AfmBOorEzbiEiYzBZc5uP31Zun7vFrenM-uG87mVrpyvIEMeTRDPFhWS";

/** Delivery, as a band between hairlines: the logo, what it is, and the way there. */
export default function UberEats() {
  const { language } = useLanguage();
  const en = language === "en";
  return (
    <section className="border-y border-border">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 px-5 py-8 lg:flex-row lg:items-center lg:gap-7 lg:py-9">
        <Image
          src="/uber-eats.png"
          alt="Uber Eats"
          width={200}
          height={200}
          className="h-[72px] w-[72px] object-contain lg:h-28 lg:w-28"
        />
        <div className="flex flex-col gap-1.5 lg:flex-1">
          <h2 className="text-[22px] font-extrabold lg:text-[26px]">
            {en
              ? "We deliver with Uber Eats"
              : "我们通过 Uber Eats 提供配送服务"}
          </h2>
          <p className="text-[15px] text-muted-foreground lg:text-[17px]">
            {en
              ? "Enjoy your favourite desserts and drinks delivered straight to your door."
              : "享受您最喜欢的甜点和饮料直接送到您家门口。"}
          </p>
        </div>
        <Button
          asChild
          variant="secondary"
          size="pill"
          className="mt-1.5 gap-2.5 lg:mt-0 lg:h-14 lg:text-[17px]"
        >
          <Link
            href={UBER_EATS_STORE}
            rel="noopener noreferrer"
            target="_blank"
          >
            {en ? "Order with Uber Eats" : "订购与 Uber Eats"}
            <ExternalLink className="h-[17px] w-[17px]" aria-hidden />
            <span className="sr-only">
              {en ? " (opens in a new tab)" : "（在新标签页中打开）"}
            </span>
          </Link>
        </Button>
      </div>
    </section>
  );
}
