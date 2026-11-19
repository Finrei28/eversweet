"use client";

import Link from "next/link";

import { useLanguage } from "~/app/components/language";
import { formatNZ } from "~/lib/pickUpTimes";
import { cn } from "~/lib/utils";
import { useCartBarShown } from "./cartBar";

const LINKS = [
  { href: "/contact", en: "Contact", zh: "联系方法" },
  { href: "/feedback", en: "Feedback", zh: "反馈" },
  {
    href: "/terms-and-conditions",
    en: "Terms and conditions",
    zh: "条款与条件",
  },
  { href: "/privacy-policy", en: "Privacy policy", zh: "隐私政策" },
  { href: "/delete-account", en: "Delete account", zh: "删除账户" },
] as const;

/**
 * The site footer, and the only place the legal documents are linked from.
 *
 * It used to be written inline at the bottom of `homePageContent.tsx`, so it rendered on
 * the home page and nowhere else - which meant the privacy policy was unreachable from the
 * menu, the checkout, the contact page or the feedback form. A customer part-way through
 * paying had no way to read what the checkout told them they were agreeing to.
 *
 * Apricot as it was, with red-bean ink on it (7.65:1) where the text was white (1.95:1 on the old apricot).
 * While the cart bar is up it leaves room under its last line, so the bar never sits
 * over the trademark notice.
 *
 * It is a client component because `useLanguage` throws outside its provider, which sits
 * under the client boundary. The legal pages themselves stay server components; only their
 * link labels are translated, because the documents are English-only.
 */
export default function SiteFooter() {
  const { language } = useLanguage();
  const cartBarShown = useCartBarShown();

  return (
    <footer
      className={cn(
        "mt-auto w-full bg-primary text-primary-foreground",
        cartBarShown ? "pb-24 md:pb-28" : "pb-9 md:pb-10",
      )}
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-[18px] px-5 pt-8 md:gap-5 md:pt-11">
        <div className="flex flex-col gap-[18px] md:flex-row md:items-center md:justify-between md:gap-6">
          <nav
            aria-label={language === "en" ? "Footer" : "页脚"}
            className="grid grid-cols-2 gap-x-4 gap-y-1 text-base font-bold md:flex md:flex-wrap md:gap-x-7 md:gap-y-2"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-2.5 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:py-0"
              >
                {language === "en" ? link.en : link.zh}
              </Link>
            ))}
          </nav>
          <p className="shrink-0 text-sm font-semibold">
            © {formatNZ(new Date(), "yyyy")} Eversweet. All rights reserved.
          </p>
        </div>
        {/*
          The credit lines both stores ask for wherever their badges are used, placed once
          where the site gives its legal notice. Apple allows the notice translated, never
          the marks themselves.
        */}
        <p className="max-w-[860px] text-xs leading-normal">
          {language === "en"
            ? "Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other countries. App Store is a service mark of Apple Inc., registered in the U.S. and other countries. Google Play and the Google Play logo are trademarks of Google LLC."
            : "Apple 和 Apple 标志是 Apple Inc. 在美国和其他国家/地区注册的商标。App Store 是 Apple Inc. 在美国和其他国家/地区注册的服务标记。Google Play 和 Google Play 标志是 Google LLC 的商标。"}
        </p>
      </div>
    </footer>
  );
}
