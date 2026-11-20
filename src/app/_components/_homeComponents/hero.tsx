"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { Clock } from "lucide-react";

import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import { useHydrated, useMinuteClock } from "~/lib/browserState";
import { openToday, timeOfDay } from "~/lib/openToday";
import { toDaysOffKeys, toWeeklyHours } from "~/lib/pickUpTimes";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { POPULAR_ROW } from "./top-desserts";

/**
 * "Open today until 10:00 pm", from the trading hours and days off the page loads
 * anyway (the opening hours below, the days-off notice). Drawn once hydrated: it
 * depends on the minute it is read, which the server and the browser would see
 * differently. Re-read each minute and when the tab comes back into view, so a page
 * left open moves on to "Closed today".
 */
function OpenTodayLine({ address }: { address?: string }) {
  const { language } = useLanguage();
  const hydrated = useHydrated();
  const { data: rows } = api.store.getTradingHours.useQuery();
  const { data: daysOff } = api.store.getDaysOff.useQuery();
  const now = useMinuteClock();

  const today = useMemo(
    () =>
      rows && daysOff
        ? openToday(now, {
            hours: toWeeklyHours(rows),
            daysOff: toDaysOffKeys(daysOff),
          })
        : null,
    [rows, daysOff, now],
  );

  // Holds its line's height while there is nothing to say yet.
  if (!hydrated || !today) return <div className="h-6" aria-hidden />;

  const en = language === "en";
  const line =
    today.state === "open"
      ? en
        ? `Open today until ${timeOfDay(today.until, "en")}`
        : `今天营业至 ${timeOfDay(today.until, "zh")}`
      : today.state === "opens-later"
        ? en
          ? `Opens today at ${timeOfDay(today.at, "en")}`
          : `今天 ${timeOfDay(today.at, "zh")} 开始营业`
        : en
          ? "Closed today"
          : "今天休息";

  return (
    <p className="flex min-h-6 items-center gap-2 text-sm font-semibold text-muted-foreground md:text-[15px]">
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          today.state === "open" ? "bg-success" : "bg-muted-foreground",
        )}
      />
      <span>
        {line}
        {/* The address on wider screens, where the line has the room. */}
        {address && <span className="hidden lg:inline">, {address}</span>}
      </span>
    </p>
  );
}

/**
 * Three desserts on rice, beside the heading on desktop and under it on a phone. Taken
 * from the popular choices, which the page prefetches anyway, so the art is always
 * something on the menu. The three after the row of five below, where there are that
 * many, so the hero does not repeat the row; otherwise the last three.
 *
 * In no Suspense boundary of its own: the first bowl is the page's largest paint on a
 * phone, and React streams a boundary this size (the images' srcsets alone are some 10KB)
 * after the shell, revealing it only after the first paint - about 400ms late. The home
 * page awaits the query, so on the server this never waits.
 */
function HeroBowls() {
  const [popular] = api.dessert.getMostPopularProducts.useSuspenseQuery();
  const bowls = (
    popular.length >= POPULAR_ROW + 3
      ? popular.slice(POPULAR_ROW, POPULAR_ROW + 3)
      : popular.slice(-3)
  ).map((d) => d.imagePath);
  return <BowlCircles images={bowls} />;
}

function BowlCircles({ images }: { images: (string | undefined)[] }) {
  const placed = [
    "left-0 top-[10px] h-[230px] w-[230px] lg:left-10 lg:top-10 lg:h-[400px] lg:w-[400px]",
    "right-0 top-0 h-[140px] w-[140px] lg:h-[230px] lg:w-[230px]",
    "bottom-0 right-1.5 h-[150px] w-[150px] lg:right-5 lg:h-[250px] lg:w-[250px]",
  ];
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[250px] w-full max-w-[350px] lg:h-[470px] lg:max-w-none"
    >
      {placed.map((position, index) => (
        <span
          key={position}
          className={cn(
            "absolute overflow-hidden rounded-full bg-muted",
            position,
          )}
        >
          {images[index] && (
            <Image
              src={images[index]}
              alt=""
              fill
              sizes="(min-width: 1024px) 400px, 230px"
              className="object-cover"
              priority={index === 0}
            />
          )}
        </span>
      ))}
    </div>
  );
}

export function Hero({
  address,
  onOpeningHours,
}: {
  address?: string;
  onOpeningHours: () => void;
}) {
  const { language } = useLanguage();
  const en = language === "en";

  return (
    <section className="mx-auto grid w-full max-w-[1240px] items-center gap-4 px-5 pb-8 pt-6 lg:grid-cols-2 lg:gap-12 lg:pb-14 lg:pt-[72px]">
      <div className="flex flex-col gap-4 lg:gap-5">
        <OpenTodayLine address={address} />
        <h1 className="text-balance text-[34px] font-extrabold leading-[1.08] tracking-[-0.01em] md:text-5xl lg:text-[60px] lg:leading-[1.05] lg:tracking-[-0.02em]">
          {en
            ? "Chinese desserts and drinks in Somerville"
            : "Somerville 的中式甜品和饮品"}
        </h1>
        <p className="max-w-[470px] text-[17px] leading-relaxed text-muted-foreground lg:text-[19px]">
          {en
            ? "Order online and pick up at the shop, or have it delivered with Uber Eats, DoorDash or HungryPanda."
            : "网上下单到店自取，或通过 Uber Eats、DoorDash 或熊猫外卖送货上门。"}
        </p>
        <div className="mt-1 flex flex-col gap-2.5 sm:flex-row sm:gap-3 lg:mt-2">
          <Button asChild size="cta" className="px-8">
            <Link href="/menu">{en ? "Order online" : "线上点菜"}</Link>
          </Button>
          <Button
            variant="secondary"
            size="pill"
            className="gap-2 sm:h-14 sm:text-[17px]"
            onClick={onOpeningHours}
          >
            <Clock
              className="h-[19px] w-[19px]"
              strokeWidth={1.9}
              aria-hidden
            />
            {en ? "Opening hours" : "营业时间"}
          </Button>
        </div>
      </div>
      <HeroBowls />
    </section>
  );
}
