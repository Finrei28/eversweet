"use client";

import Image from "next/image";

import { useLanguage } from "~/app/components/language";
import StoreBadges from "~/app/components/storeBadges";
import { api } from "~/trpc/react";

/**
 * Under a confirmed website order: the one thing it did not get.
 *
 * Website orders earn no Sweet Points - there are no accounts here to hold them (Terms 5 and
 * 12) - so a customer who has just paid is the one most likely to care. It is the same for
 * every website order, so it needs nothing from the order itself. Kept off the receipt when
 * printed.
 *
 * Its whole case is that app orders earn points, which stops being true while /admin/settings
 * has earning switched off (a rate or modifier of 0), so it waits to be told they do
 * (`~/server/appPromotion`) and shows nothing until then, or at all on a failed read.
 */
export default function EarnInTheApp() {
  const { language } = useLanguage();
  const { data: promotion } = api.store.getAppPromotion.useQuery();

  if (!promotion?.pointsEarned) return null;
  // A white card: the icon and the case for the app, with the badges under them on a phone
  // and at the end of the row from `lg`, as the mock-ups draw it.
  return (
    <section className="mt-8 rounded-card border border-border bg-card p-5 lg:mt-11 lg:flex lg:items-center lg:gap-5 lg:px-7 lg:py-6 print:hidden">
      <div className="flex gap-3.5 lg:flex-1 lg:items-center lg:gap-5">
        <Image
          src="/eversweet-app-icon.png"
          alt=""
          width={512}
          height={512}
          className="h-[52px] w-[52px] shrink-0 rounded-[12px] border border-border bg-card lg:h-[60px] lg:w-[60px] lg:rounded-[14px]"
        />
        <div className="flex flex-col gap-1">
          <h2 className="break-keep text-[17px] font-extrabold lg:text-[19px]">
            {language === "en"
              ? "This order didn't earn Sweet Points"
              : "本订单未获得 Sweet Points 积分"}
          </h2>
          <p className="text-sm leading-[1.45] text-muted-foreground lg:text-[15px]">
            {language === "en"
              ? "Orders in the Eversweet app earn points you can spend on selected desserts, and the app has offers you won't find on the website."
              : "在 Eversweet 应用下单可赚取积分，用来兑换指定甜品；应用里还有网站上没有的优惠。"}
          </p>
        </div>
      </div>
      <StoreBadges
        size="md"
        className="mt-3.5 lg:mt-0 lg:shrink-0 lg:flex-nowrap"
      />
    </section>
  );
}
