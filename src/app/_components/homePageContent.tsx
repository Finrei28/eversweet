"use client";

import Link from "next/link";
import { TopDesserts } from "./top-desserts";
import { Button } from "~/components/ui/button";
import { useLanguage } from "../components/language";

export default function HomePageContent() {
  const { language } = useLanguage();
  return (
    <div className="flex min-h-screen flex-col">
      <main className="-mt-[10%] flex flex-grow flex-col items-center justify-center text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <TopDesserts />
        </div>
        <Link href={"/menu"}>
          <Button className="p-7 text-2xl">
            {language === "en" ? "ORDER ONLINE" : "线上点菜"}
          </Button>
        </Link>
      </main>
      <footer className="w-full bg-primary py-6 text-white">
        <div className="container mx-auto flex flex-col items-center gap-4 text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} Eversweet. All rights reserved.
          </p>
          <nav className="flex gap-4">
            <Link href="/about-us" className="hover:underline">
              {language === "en" ? "About Us" : "关于我们"}
            </Link>
            <Link href="/contact" className="hover:underline">
              {language === "en" ? "Contact" : "联系方法"}
            </Link>
            <Link href="/feedback" className="hover:underline">
              {language === "en" ? "Feedback" : "反馈"}
            </Link>
            <Link href="/privacy" className="hover:underline">
              {language === "en" ? "Privacy Policy" : "隐私政策"}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
