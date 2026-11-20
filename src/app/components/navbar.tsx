"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ComponentProps, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Menu, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import Image from "next/image";
import { useLanguage } from "./language";
import { Globe } from "lucide-react";

/**
 * Admin's navbar. The customer pages have their own header (`siteHeader.tsx`), the
 * cart sheet and the cart bar; this kept only what admin uses, laid out exactly as
 * before - the logo reserve and eight links at 1280px (CLAUDE.md, Admin UI
 * conventions). The `/admin` checks below are what made it admin's layout when the
 * customer pages shared it.
 */
export function Navbar({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathName = usePathname();
  const { language, toggleLanguage } = useLanguage();
  const [globeOpen, setGlobeOpen] = useState(false);
  const globeRef = useRef<HTMLDivElement>(null);
  const globeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // Check if click is outside both the menu and the toggle button
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        event.stopPropagation();
        event.preventDefault();
        setIsOpen(false);
      }

      if (
        globeOpen &&
        globeRef.current &&
        !globeRef.current.contains(event.target as Node) &&
        globeButtonRef.current &&
        !globeButtonRef.current.contains(event.target as Node)
      ) {
        setGlobeOpen(false);
      }
    };

    // Add event listener when the menu or the language picker is open
    if (isOpen || globeOpen) {
      document.addEventListener("click", handleClickOutside, true);
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, {
        passive: false,
      });
    }
    // Cleanup function
    return () => {
      document.removeEventListener("click", handleClickOutside, true);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside, {
        passive: false,
      } as any);
    };
  }, [isOpen, globeOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathName]);

  return (
    <>
      <div>
        {/* Desktop Navbar */}
        <nav
          className={cn(
            "relative hidden items-center justify-center py-10 text-primary xl:flex",
          )}
        >
          <div className="relative mx-auto flex w-full max-w-7xl items-center px-4">
            {/* Logo */}

            <div
              className={cn(
                "absolute transition-[height] duration-300 ease-out lg:h-28 xl:left-4 xl:h-32",
              )}
            >
              <Link href={pathName.startsWith("/admin") ? `${pathName}` : "/"}>
                <Image
                  src={process.env.NEXT_PUBLIC_LOGO_URL as string}
                  alt="logo"
                  width={150}
                  height={150}
                  className="h-full w-full rounded-full"
                  priority
                />
              </Link>
            </div>

            {/* Navigation links centered */}
            <div
              className={cn(
                "flex flex-1 items-center justify-center",
                /**
                 * The logo is absolutely positioned, so this row centres across the
                 * whole container without knowing the logo is there. Five links left
                 * enough slack for that to go unnoticed; the admin nav has seven, and
                 * the first one ran underneath the logo.
                 *
                 * Reserving the logo's width (pl-64 = 256px, its measured width at
                 * xl:h-32) and tightening the gap fits all seven inside the container,
                 * which is capped at max-w-7xl and so never gets roomier on a wider
                 * screen. Admin only - the customer nav has fewer links and should stay
                 * centred on the full width.
                 *
                 * The eighth, Settings, then ran under the language button at 1280px,
                 * which sits absolutely at the right just as the logo does at the left:
                 * a click on "Settings" opened the language menu instead. pr-32 reserves
                 * the button's side the same way, and NavbarLink sets the admin labels
                 * a size smaller so all eight still fit between the two.
                 */
                pathName.startsWith("/admin") ? "gap-2 pl-64 pr-32" : "gap-8",
              )}
            >
              {children}
            </div>
          </div>

          {/* Language switcher */}
          <div className="absolute right-20 flex items-center gap-1">
            <Button
              variant={"ghost"}
              onClick={() => setGlobeOpen(!globeOpen)}
              ref={globeButtonRef}
            >
              <Globe className="hover:cursor-pointer" />
            </Button>
            <div
              ref={globeRef}
              className={cn(
                "absolute right-5 z-50 mt-40 hidden rounded-xl bg-white text-lg font-bold text-primary shadow-lg xl:block",
                "transform flex-col items-center transition-all duration-500 ease-in-out first:pt-0 last:pb-0",
                globeOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-4 opacity-0",
              )}
            >
              <div className="flex flex-col items-center gap-2 p-4">
                <Button
                  onClick={toggleLanguage}
                  disabled={language === "en"}
                  variant={"ghost"}
                  className={`${language === "en" && "bg-primary text-primary-foreground"} w-full`}
                >
                  <span>English</span>
                </Button>

                <Button
                  onClick={toggleLanguage}
                  disabled={language === "zh"}
                  variant={"ghost"}
                  className={`${language === "zh" && "bg-primary text-primary-foreground"} w-full`}
                >
                  <span>中文</span>
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile navbar */}
        <div className="relative flex w-full justify-between px-4 text-primary xl:hidden">
          <Link
            href={pathName.startsWith("/admin") ? `${pathName}` : "/"}
            className="pt-4 transition-[height] duration-300 ease-out"
          >
            <Image
              src={process.env.NEXT_PUBLIC_LOGO_URL as string}
              alt="logo"
              width={150}
              height={150}
              className="h-full w-full rounded-full"
              priority
            />
          </Link>

          <Button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            className={`${pathName.startsWith("/admin") ? "mr-4 mt-14" : "fixed"} right-8 top-8 z-30 p-2 md:p-4`}
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? <X size={30} /> : <Menu size={30} />}
          </Button>
        </div>
      </div>
      {/* Mobile Menu */}
      <div
        ref={menuRef}
        className={cn(
          "absolute right-5 top-20 z-50 rounded-xl bg-white p-6 py-3 text-lg font-bold text-primary shadow-lg xl:hidden",
          "fixed flex transform flex-col items-center transition-all duration-500 ease-in-out",
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-4 opacity-0",
        )}
      >
        <div className="flex flex-col items-center divide-y divide-secondary">
          {children}

          <span onClick={toggleLanguage} className="w-full py-2 text-center">
            {language === "en" ? "中文" : "English"}
          </span>
        </div>
      </div>
    </>
  );
}

export function NavbarLink({
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "className">) {
  const pathName = usePathname();
  return (
    <Link
      {...props}
      className={cn(
        // `isolate` keeps the pending pill's -z-10 inside the link, rather than
        // behind whatever the nav happens to sit on.
        "relative isolate",
        // Hover used to fade the label to the pale secondary, which all but
        // erased it. Underline keeps the affordance without losing contrast.
        "p-3 text-base hover:underline md:p-4 md:text-lg lg:text-xl",
        // Desktop admin row only (the mobile menu is xl:hidden): eight links have
        // to fit between the logo and the language button. See the row above.
        pathName.startsWith("/admin") &&
          "whitespace-nowrap xl:px-2.5 xl:text-lg",
        // The current-page pill was caramel on pale peach (3.51:1); inverting
        // it reads more clearly as "you are here" and measures 4.86:1.
        pathName === props.href &&
          "rounded-full bg-primary text-primary-foreground hover:no-underline",
      )}
    >
      <PendingPill />
      {children}
    </Link>
  );
}

/**
 * Answers the click while the next page is on its way.
 *
 * A route's loading.tsx covers most of the wait, but not all of it: the loading
 * state itself comes from the server unless the link was prefetched, which dev
 * never does. Until then nothing on screen changed, so the admin looked frozen.
 *
 * Absolutely positioned so it takes no room - the admin row is already packed
 * tight around the logo. The delay keeps it from flashing on a navigation that
 * is effectively instant.
 */
function PendingPill() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        // Faded with opacity, which transitions in. It was also the only way to fade
        // it while --primary was written with commas, when every bg-primary/NN came
        // out invalid; the token is space-separated now and those work.
        "pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary",
        "opacity-0 transition-opacity",
        pending && "animate-pulse opacity-30 delay-100",
      )}
    />
  );
}
