"use client";

import { useState } from "react";
import NotificationModal from "../_components/_homeComponents/notification";
import { useLanguage } from "../components/language";
import { Navbar, NavbarLink } from "../components/navbar";
import { api } from "~/trpc/react";
import { format } from "date-fns";

export default function CustomerFacingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { language } = useLanguage();
  const [notificationModalOpen, setNotificationModalOpen] = useState(true);
  const { data } = api.store.getDaysOff.useQuery();
  const daysOff = data ?? [];
  const sortedDaysOff = [...daysOff].sort((a, b) => a.getTime() - b.getTime());
  const formattedDaysOffText =
    sortedDaysOff.length === 0
      ? ""
      : sortedDaysOff.length === 1
        ? format(sortedDaysOff[0]!, "dd/MM")
        : `${sortedDaysOff
            .slice(0, -1)
            .map((date) => format(date, "dd/MM"))
            .join(
              ", ",
            )} and ${format(sortedDaysOff[sortedDaysOff.length - 1]!, "dd/MM")}`;
  return (
    <>
      <Navbar>
        <NavbarLink href={"/menu"}>
          {language === "en" ? "Menu" : "菜单"}
        </NavbarLink>
        {/* <NavbarLink href={"/about-us"}>
          {language === "en" ? "About us" : "关于我们"}
        </NavbarLink> */}
        <NavbarLink href={"/contact"}>
          {language === "en" ? "Contact" : "联系方法"}
        </NavbarLink>
        <NavbarLink href={"/feedback"}>
          {language === "en" ? "Feedback" : "反馈"}
        </NavbarLink>
      </Navbar>

      <div>{children}</div>
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
    </>
  );
}
