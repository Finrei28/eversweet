"use client";

import Link from "next/link";
import { TopDesserts } from "./_homeComponents/top-desserts";
import { Button } from "~/components/ui/button";
import { useLanguage } from "../components/language";
import { Separator } from "~/components/ui/separator";
import UberEats from "./_homeComponents/uber-eats";
import OpeningHours from "./_homeComponents/opening-hours";
import MenuPhotos from "./_homeComponents/menu-photos";

export default function HomePageContent() {
  const { language } = useLanguage();
  return (
    <div className="flex min-h-screen flex-col lg:mt-0">
      <main className="flex flex-grow flex-col items-center justify-center py-5 text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <TopDesserts />
        </div>
        <Link href={"/menu"}>
          <Button className="p-7 text-2xl lg:p-8 lg:text-3xl">
            {language === "en" ? "ORDER ONLINE" : "线上点菜"}
          </Button>
        </Link>
      </main>
      <Separator className="my-10 bg-secondary" />
      <MenuPhotos />
      <Separator className="my-10 bg-secondary" />
      <UberEats />
      <Separator className="my-10 bg-secondary" />
      <OpeningHours />
      <Separator className="my-10 bg-secondary" />
      <footer className="mt-auto w-full bg-primary py-6 text-white">
        <div className="container mx-auto flex flex-col items-center gap-4 text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} Eversweet. All rights reserved.
          </p>
          <nav className="flex flex-col gap-5 lg:flex-row lg:gap-10">
            <Link href="/about-us" className="hover:underline">
              {language === "en" ? "About Us" : "关于我们"}
            </Link>
            <Link href="/contact" className="hover:underline">
              {language === "en" ? "Contact" : "联系方法"}
            </Link>
            <Link href="/feedback" className="hover:underline">
              {language === "en" ? "Feedback" : "反馈"}
            </Link>
            <Link href="/privacy-policy" className="hover:underline">
              {language === "en" ? "Privacy Policy" : "隐私政策"}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
