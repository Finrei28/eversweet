"use client";

import { useState } from "react";
import NotificationModal from "../_components/_homeComponents/notification";
import { useLanguage } from "../components/language";
import { CartBar } from "../components/cartBar";
import { CartSheet } from "../components/cartSheet";
import { SiteHeader } from "../components/siteHeader";
import SiteFooter from "../components/siteFooter";
import ScrollToTopButton from "./menu/_components/toTop";
import { api } from "~/trpc/react";
import { format } from "date-fns";
import { usePathname } from "next/navigation";

export default function CustomerFacingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { language } = useLanguage();
  const pathName = usePathname();
  const [notificationModalOpen, setNotificationModalOpen] = useState(true);
  const { data: daysOff } = api.store.getDaysOff.useQuery();

  const formattedDaysOffText =
    daysOff && daysOff.length > 0
      ? daysOff.length === 1
        ? format(daysOff[0]!, "dd/MM")
        : `${daysOff
            .slice(0, -1)
            .map((date) => format(date, "dd/MM"))
            .join(", ")} and ${format(daysOff[daysOff.length - 1]!, "dd/MM")}`
      : "";

  // A full-height column with the page growing to fill it, so the footer's mt-auto has
  // something to push against. Without it the footer sat wherever the content ended -
  // under the navbar while the menu loaded, since the loader is `fixed` and takes no room.
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <div className="flex-1">{children}</div>
      <SiteFooter />

      <CartBar />
      <CartSheet />
      {pathName !== "/checkout" && <ScrollToTopButton />}

      {daysOff && daysOff.length > 0 && (
        <NotificationModal
          open={notificationModalOpen}
          onClose={() => setNotificationModalOpen(false)}
          title={language === "en" ? "Announcement" : "通知"}
        >
          {language === "en"
            ? `We will be closed on ${formattedDaysOffText}. Sorry for the inconvenience! We will be open as usual on all other days. Thank you for your understanding!`
            : `我们将于 ${formattedDaysOffText} 休息。对于由此带来的不便，我们深表歉意！除上述日期外，我们将照常营业。感谢您的理解！`}
        </NotificationModal>
      )}
    </div>
  );
}
