"use client";

import { useLanguage } from "../components/language";
import { Navbar, NavbarLink } from "../components/navbar";

export default function CustomerFacingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { language } = useLanguage();
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

      <div className="my-6">{children}</div>
    </>
  );
}
