"use client";

import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import {
  BadgePercent,
  BellRing,
  Crown,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { useLanguage } from "~/app/components/language";
import StoreBadges from "~/app/components/storeBadges";
import { api } from "~/trpc/react";

/**
 * The home page's case for the customer app: what it has that this website does not, and
 * the two store badges.
 *
 * Every line is something the app does and the website cannot, and is said in the legal
 * documents too: Sweet Points, membership and offers (Terms 5, 12, 14), the leaderboard
 * (Terms 13), order history (Terms 5) and notifications (Privacy 9).
 * `src/lib/appStores.test.ts` fails if one of those stops being app-only. The wording stays
 * general on purpose - "selected desserts", "member prices" - because the rates, the plan's
 * benefits and the offers are edited from /admin/settings and /admin/offers, and a number
 * written here would go on promising last month's figure.
 *
 * The lines those settings can make untrue follow them (`~/server/appPromotion`): no Sweet
 * Points line while earning is off, no "higher points rate" while members earn 1x, and no
 * leaderboard while it is hidden or nobody can earn.
 */
function Feature({
  icon: Icon,
  title,
  children,
}: {
  /** A line icon in apricot, or "seal" for the 甜 seal Sweet Points wears in the app. */
  icon: LucideIcon | "seal";
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3.5 lg:gap-[18px]">
      {Icon === "seal" ? (
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 -rotate-[4deg] items-center justify-center rounded-[9px] bg-accent lg:h-12 lg:w-12 lg:rounded-seal"
        >
          <span className="font-zh text-[22px] font-black leading-none text-accent-foreground lg:text-[27px]">
            甜
          </span>
        </span>
      ) : (
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center text-primary lg:h-12 lg:w-12"
        >
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </span>
      )}
      <div className="flex flex-col gap-[3px] lg:gap-1">
        <h3 className="text-base font-bold lg:text-lg">{title}</h3>
        <p className="text-sm leading-[1.45] text-secondary lg:text-[15px]">
          {children}
        </p>
      </div>
    </li>
  );
}

/**
 * Suspends on the home page's prefetch of what may be claimed, so the list arrives in the
 * HTML as it will stay, rather than gaining or losing a line after it.
 */
function Features() {
  const { language } = useLanguage();
  const [{ pointsEarned, memberRateHigher, leaderboardShown }] =
    api.store.getAppPromotion.useSuspenseQuery();

  return (
    <ul className="grid gap-y-[18px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:gap-y-6 lg:self-center">
      {pointsEarned && (
        <Feature
          icon="seal"
          title={language === "en" ? "Sweet Points" : "Sweet Points 积分"}
        >
          {language === "en"
            ? "Earn points on your app orders and spend them on selected desserts."
            : "应用订单可赚取积分，用来兑换指定甜品。"}
        </Feature>
      )}
      <Feature icon={Crown} title={language === "en" ? "Membership" : "会员"}>
        {memberRateHigher
          ? language === "en"
            ? "An optional monthly membership with member prices, member-only offers and a higher points rate."
            : "可选的月度会员：享受会员价、会员专属优惠和更高的积分倍率。"
          : language === "en"
            ? "An optional monthly membership with member prices and member-only offers."
            : "可选的月度会员：享受会员价和会员专属优惠。"}
      </Feature>
      <Feature
        icon={BadgePercent}
        title={language === "en" ? "App-only offers" : "应用专属优惠"}
      >
        {language === "en"
          ? "Deals you won't find on the website."
          : "网站上没有的优惠。"}
      </Feature>
      {leaderboardShown && (
        <Feature
          icon={Trophy}
          title={language === "en" ? "Monthly leaderboard" : "每月排行榜"}
        >
          {language === "en"
            ? "The top three Sweet Points earners each month win a prize from the shop."
            : "每月赚取积分最多的前三名，可获得本店送出的奖品。"}
        </Feature>
      )}
      <Feature
        icon={BellRing}
        title={language === "en" ? "Your orders" : "您的订单"}
      >
        {language === "en"
          ? "See your past orders, order a favourite again, and get a notification when yours is ready."
          : "查看历史订单、再点一次心头好，订单做好时还会收到通知。"}
      </Feature>
    </ul>
  );
}

/**
 * The features' boundary, made once. GetTheApp reads the language, so the saved language
 * switching it re-renders it; a fresh `<Suspense>` each time would hand the boundary new
 * props before it had hydrated - the features wait on a streamed query - and React would
 * throw the server's list away and draw it again. The same element every time leaves it
 * to hydrate.
 */
const features = (
  <Suspense fallback={null}>
    <Features />
  </Suspense>
);

export default function GetTheApp() {
  const { language } = useLanguage();

  return (
    // One column on a phone: the pitch, what the app has, then the badges. From `lg` the
    // features take the right-hand column on their own and the pitch and badges share the
    // left, so however many features the settings allow (three to five), none is left alone
    // on a row. Each is placed explicitly, so the badges stay put while the list suspends.
    <div className="mx-auto grid w-full max-w-[1200px] gap-4 rounded-[24px] bg-inverse p-6 text-inverse-foreground lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-x-16 lg:gap-y-6 lg:rounded-sheet lg:p-14">
      <div className="flex items-center gap-3.5 lg:col-start-1 lg:row-start-1 lg:flex-col lg:items-start lg:gap-5 lg:self-end">
        {/* The app's own icon, so it can be recognised in the store. */}
        <Image
          src="/eversweet-app-icon.png"
          alt=""
          width={512}
          height={512}
          className="h-16 w-16 shrink-0 rounded-[15px] bg-card lg:h-[88px] lg:w-[88px] lg:rounded-[20px]"
        />
        <div>
          {/* `break-keep` so the Chinese wraps at its comma, not inside 享受. */}
          <h2 className="break-keep text-2xl font-extrabold leading-[1.15] lg:text-[40px] lg:leading-[1.1]">
            {language === "en"
              ? "Get more in the Eversweet app"
              : "在 Eversweet 应用里，享受更多"}
          </h2>
          <p className="mt-4 hidden break-keep text-[17px] leading-normal text-secondary lg:block">
            {language === "en"
              ? "Order ahead on your iPhone or Android phone, and get what only the app has."
              : "用 iPhone 或 Android 手机提前下单，享受应用独有的功能。"}
          </p>
        </div>
      </div>

      {/* On a phone the line moves under the heading's row, as the mock-ups draw it. */}
      <p className="break-keep text-[15px] leading-[1.45] text-secondary lg:hidden">
        {language === "en"
          ? "Order ahead on your iPhone or Android phone, and get what only the app has."
          : "用 iPhone 或 Android 手机提前下单，享受应用独有的功能。"}
      </p>

      {features}

      <StoreBadges
        tone="dark"
        className="mt-2 lg:col-start-1 lg:row-start-2 lg:mt-0 lg:self-start"
      />
    </div>
  );
}
