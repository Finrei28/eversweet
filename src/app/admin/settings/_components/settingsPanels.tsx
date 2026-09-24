"use client";

import { useLanguage } from "~/app/components/language";
import { AnnouncementsCard } from "./announcementsCard";
import { LoyaltyRatesCard } from "./loyaltyRatesCard";
import { MembershipBenefitsCard } from "./membershipBenefitsCard";
import { PointsExpiryCard } from "./pointsExpiryCard";
import { ShopProfileCard } from "./shopProfileCard";

/**
 * Independent cards rather than one form. Each saves on its own, because they change
 * on completely different rhythms - a double-points weekend is set and unset within days,
 * the shop's address about once a decade - and one Save button over all of them would make
 * every edit look like a change to everything.
 */
export function SettingsPanels() {
  const { language } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {language === "en" ? "Settings" : "设置"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {language === "en"
            ? "The customer app reads these. A change takes up to a minute to reach it, so make one outside trading hours if the timing matters."
            : "顾客应用程序会读取这些设置。更改最多需要一分钟才能生效，如果时间很重要，请在营业时间之外进行更改。"}
        </p>
      </div>

      <LoyaltyRatesCard />
      <PointsExpiryCard />
      <MembershipBenefitsCard />
      <AnnouncementsCard />
      <ShopProfileCard />
    </div>
  );
}
