"use client";

import { CartBar } from "../components/cartBar";
import { CartSheet } from "../components/cartSheet";
import { DaysOffNotice } from "../components/daysOffNotice";
import { SiteHeader } from "../components/siteHeader";
import SiteFooter from "../components/siteFooter";
import ScrollToTopButton from "./menu/_components/toTop";
import { api } from "~/trpc/react";
import { usePathname } from "next/navigation";

export default function CustomerFacingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathName = usePathname();
  const { data: daysOff } = api.store.getDaysOff.useQuery();

  // A full-height column with the page growing to fill it, so the footer's mt-auto has
  // something to push against. Without it the footer sat wherever a short page ended. The
  // loader used to be one, `fixed` and taking no room; it now holds the footer down itself.
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <div className="flex-1">{children}</div>
      <SiteFooter />

      <CartBar />
      <CartSheet />
      {pathName !== "/checkout" && <ScrollToTopButton />}

      {daysOff && daysOff.length > 0 && <DaysOffNotice daysOff={daysOff} />}
    </div>
  );
}
