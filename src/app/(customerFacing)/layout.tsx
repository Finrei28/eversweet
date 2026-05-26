"use client";

import { useState } from "react";
import NotificationModal from "../_components/_homeComponents/notification";
import { useLanguage } from "../components/language";
import { Navbar, NavbarLink } from "../components/navbar";

export default function CustomerFacingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { language } = useLanguage();
  const [notificationModalOpen, setNotificationModalOpen] = useState(true);
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
      {/* <NotificationModal
        open={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        title={language === "en" ? "Announcement" : "通知"}
      >
        {language === "en"
          ? "We are closed today on the 26/05/2026. Sorry for the inconvenience! We will be back to normal business hours tomorrow. Thank you for your understanding!"
          : "我们将于2026年5月26日（今天）休息一天。对于由此带来的不便，我们深表歉意！我们将于明天恢复正常营业时间。感谢您的理解！"}
      </NotificationModal> */}
    </>
  );
}
