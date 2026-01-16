"use client";

import Link from "next/link";
import { TopDesserts } from "./_homeComponents/top-desserts";
import { Button } from "~/components/ui/button";
import { useLanguage } from "../components/language";
import { Separator } from "~/components/ui/separator";
import UberEats from "./_homeComponents/uber-eats";
import OpeningHours from "./_homeComponents/opening-hours";
import MenuPhotos from "./_homeComponents/menu-photos";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Loader from "../components/customLoading";
import NotificationModal from "./_homeComponents/notification";

function HomePageContent() {
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const openingHoursRef = useRef<HTMLDivElement>(null);

  // states for notifications

  {
    /* 
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const NOTIFICATION_KEY = "notification_shown";
  */
  }

  useEffect(() => {
    if (searchParams.get("scrollTo") === "opening-hours") {
      setTimeout(() => {
        openingHoursRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300); // slight delay to ensure DOM is ready
    }
  }, [searchParams]);

  // useeffect for notifications

  // useEffect(() => {
  //   const hasShown = sessionStorage.getItem(NOTIFICATION_KEY);

  //   if (!hasShown) {
  //     setNotificationModalOpen(true);
  //     sessionStorage.setItem(NOTIFICATION_KEY, "true");
  //   }
  // }, []);

  return (
    <>
      <div className="flex min-h-screen flex-col lg:mt-0">
        <div className="bg-gradient-to-b from-background to-primary">
          <main className="flex flex-grow flex-col items-center justify-center pb-10 pt-5 text-white">
            <div className="container flex flex-col items-center justify-center gap-12 py-16 text-center">
              <TopDesserts />
            </div>
            <Link href={"/menu"}>
              <Button className="p-7 text-2xl shadow-lg lg:p-8 lg:text-3xl">
                {language === "en" ? "ORDER ONLINE" : "线上点菜"}
              </Button>
            </Link>
          </main>
          <Separator className="my-10 bg-primary" />
          <section>
            <MenuPhotos />
          </section>

          <Separator className="my-10 bg-primary" />
          <section className="mb-10">
            <UberEats />
          </section>
        </div>

        <section ref={openingHoursRef} id="opening-hours" className="my-10">
          <OpeningHours />
        </section>

        <footer className="mt-auto w-full bg-primary py-10 text-white">
          <div className="container mx-auto flex flex-col items-center gap-4 text-center">
            <p className="text-sm">
              © {new Date().getFullYear()} Eversweet. All rights reserved.
            </p>
            <nav className="flex flex-col gap-5 lg:flex-row lg:gap-10">
              {/* <Link href="/about-us" className="hover:underline">
              {language === "en" ? "About Us" : "关于我们"}
            </Link> */}
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

      {/* 
      <NotificationModal
        open={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        title={language === "en" ? "Announcement" : "通知"}
      >
        {language === "en"
          ? "Merry Christmas and Happy New Year from Eversweet! We will be closed on December 25th to January 16th and will be back on January 17th. Wishing you all a joyful holiday season!"
          : "Eversweet祝您圣诞快乐，新年快乐！我们将在12月25日至1月16日放假，将于1月17日正常营业。祝您节日愉快！"}
      </NotificationModal>

      */}
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<Loader />}>
      <HomePageContent />
    </Suspense>
  );
}
