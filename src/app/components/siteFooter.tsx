"use client";

import Link from "next/link";

import { useLanguage } from "~/app/components/language";
import { formatNZ } from "~/lib/pickUpTimes";

/**
 * The site footer, and the only place the legal documents are linked from.
 *
 * It used to be written inline at the bottom of `homePageContent.tsx`, so it rendered on
 * the home page and nowhere else - which meant the privacy policy was unreachable from the
 * menu, the checkout, the contact page or the feedback form. A customer part-way through
 * paying had no way to read what the checkout told them they were agreeing to.
 *
 * It is a client component because `useLanguage` throws outside its provider, which sits
 * under the client boundary. The legal pages themselves stay server components; only their
 * link labels are translated, because the documents are English-only.
 */
export default function SiteFooter() {
  const { language } = useLanguage();

  return (
    <footer className="mt-auto w-full bg-primary py-10 text-white">
      <div className="container mx-auto flex flex-col items-center gap-4 text-center">
        <p className="text-sm">
          © {formatNZ(new Date(), "yyyy")} Eversweet. All rights reserved.
        </p>
        <nav className="flex flex-col gap-5 lg:flex-row lg:gap-10">
          <Link href="/contact" className="hover:underline">
            {language === "en" ? "Contact" : "联系方法"}
          </Link>
          <Link href="/feedback" className="hover:underline">
            {language === "en" ? "Feedback" : "反馈"}
          </Link>
          <Link href="/terms-and-conditions" className="hover:underline">
            {language === "en" ? "Terms & Conditions" : "条款与条件"}
          </Link>
          <Link href="/privacy-policy" className="hover:underline">
            {language === "en" ? "Privacy Policy" : "隐私政策"}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
