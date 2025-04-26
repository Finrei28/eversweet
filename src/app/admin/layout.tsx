"use client";

import { useLanguage } from "../components/language";
import { Navbar, NavbarLink } from "../components/navbar";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { language } = useLanguage();
  return (
    <>
      <Navbar>
        <NavbarLink href={"/admin"}>
          {language === "en" ? "Dashboard" : "仪表板"}
        </NavbarLink>
        <NavbarLink href={"/admin/products"}>
          {language === "en" ? "Products" : "我们的产品"}
        </NavbarLink>
        <NavbarLink href={"/admin/orders"}>
          {language === "en" ? "Orders" : "当前的订单"}
        </NavbarLink>
        <NavbarLink href={"/admin/past-orders"}>
          {language === "en" ? "Past Orders" : "过去的订单"}
        </NavbarLink>
        <NavbarLink href={"/admin/feedback"}>
          {language === "en" ? "Feedbacks" : "反馈"}
        </NavbarLink>
      </Navbar>
      <div className="my-6">{children}</div>
    </>
  );
}
