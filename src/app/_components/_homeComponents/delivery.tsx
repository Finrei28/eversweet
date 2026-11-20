"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";

import { Button } from "~/components/ui/button";
import { DELIVERY_PLATFORMS } from "~/lib/deliveryPlatforms";
import { useLanguage } from "../../components/language";

/**
 * Delivery, as a band between hairlines: what it is, then a way to each platform the shop is
 * on, its app icon and name on a pill. Stacked full width on a phone, in a row from `sm`.
 * It was Uber Eats alone, with its icon as the band's picture.
 */
export default function Delivery() {
  const { language } = useLanguage();
  const en = language === "en";
  return (
    <section className="border-y border-border">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-5 py-8 lg:py-9">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[22px] font-extrabold lg:text-[26px]">
            {en
              ? "We deliver with Uber Eats, DoorDash and HungryPanda"
              : "我们通过 Uber Eats、DoorDash 和熊猫外卖提供配送服务"}
          </h2>
          <p className="text-[15px] text-muted-foreground lg:text-[17px]">
            {en
              ? "Enjoy your favourite desserts and drinks delivered straight to your door."
              : "享受您最喜欢的甜点和饮料直接送到您家门口。"}
          </p>
        </div>
        <ul className="grid gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
          {DELIVERY_PLATFORMS.map((platform) => (
            <li key={platform.name}>
              <Button
                asChild
                variant="secondary"
                size="pill"
                className="w-full justify-start gap-3 pl-2 pr-5 sm:w-auto"
              >
                <a
                  href={platform.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src={platform.icon}
                    alt=""
                    width={72}
                    height={72}
                    className="h-9 w-9 shrink-0 rounded-[22%] object-cover"
                  />
                  <span className="flex-1 text-left">
                    {en
                      ? platform.name
                      : (platform.chineseName ?? platform.name)}
                  </span>
                  <ExternalLink className="h-[17px] w-[17px]" aria-hidden />
                  <span className="sr-only">
                    {en ? " (opens in a new tab)" : "（在新标签页中打开）"}
                  </span>
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
