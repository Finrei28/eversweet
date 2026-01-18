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

  // {
  //   /*
  const [notificationModalOpen, setNotificationModalOpen] = useState(true);
  // const NOTIFICATION_KEY = "notification_shown";
  // */
  // }

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

      <NotificationModal
        open={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        title={language === "en" ? "Announcement" : "通知"}
      >
        {language === "en"
          ? "We are excited to announce that Eversweet is now open again today! Enjoy our special promotion: Buy one get one half off on all Sago desserts (excluding Durian Sago), Steamed Milk Pudding desserts (excluding Egg Milk Pudding), and our refreshing drinks! Takeout only! 😃😃 This offer is valid until the end of the month on January 31, 2026! Don't miss out on this great deal 💝"
          : "今天开张营业！全部$11.99和$9.99的西米露，各种双皮奶和冰糖雪梨，饮料系列的珍珠奶茶，烧仙草奶茶和红糖凉粉奶茶第一碗/杯原价，第二碗/杯半价！ 只限外卖！😃😃 活动到月底2026年1月31号结束！是时候来蹭一这波福利了💝"}
      </NotificationModal>
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
