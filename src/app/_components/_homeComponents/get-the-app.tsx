"use client";

import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import {
  BadgePercent,
  BellRing,
  Coins,
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
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary-dark shadow-sm">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{children}</p>
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
    <ul className="grid gap-y-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
      {pointsEarned && (
        <Feature
          icon={Coins}
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

export default function GetTheApp() {
  const { language } = useLanguage();

  return (
    // One column on a phone: the pitch, what the app has, then the badges. From `lg` the
    // features take the right-hand column on their own and the pitch and badges share the
    // left, so however many features the settings allow (three to five), none is left alone
    // on a row. Each is placed explicitly, so the badges stay put while the list suspends.
    <div className="mx-auto grid max-w-5xl gap-8 rounded-3xl bg-secondary p-6 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-x-14 lg:gap-y-8">
      <div className="flex items-center gap-4 sm:gap-6 lg:col-start-1 lg:row-start-1 lg:flex-col lg:items-start lg:self-end">
        {/* The app's own icon, so it can be recognised in the store. */}
        <Image
          src="/eversweet-app-icon.png"
          alt=""
          width={512}
          height={512}
          className="h-16 w-16 shrink-0 rounded-[22%] bg-white shadow-md sm:h-24 sm:w-24"
        />
        <div>
          {/* `break-keep` so the Chinese wraps at its comma, not inside 享受. */}
          <h2 className="break-keep text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">
            {language === "en"
              ? "Get more in the Eversweet app"
              : "在 Eversweet 应用里，享受更多"}
          </h2>
          <p className="mt-2 break-keep text-gray-600">
            {language === "en"
              ? "Order ahead on your iPhone or Android phone, and get what only the app has."
              : "用 iPhone 或 Android 手机提前下单，享受应用独有的功能。"}
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <Features />
      </Suspense>

      <StoreBadges className="lg:col-start-1 lg:row-start-2 lg:self-start" />
    </div>
  );
}
