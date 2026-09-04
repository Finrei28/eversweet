"use client";

import { api } from "~/trpc/react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import Image from "next/image";
import { Button } from "~/components/ui/button";
import {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
// Loader2 dropped: the inline loading branch it belonged to is gone, the
// page's Suspense boundary owns that state now.
import { ShoppingCart, Soup } from "lucide-react";
import { CartContext } from "~/app/components/cartContext";
import CustomisationDialog from "./customisation";
import { useLanguage } from "~/app/components/language";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "~/lib/formatters";
import { dessertOnClient } from "~/lib/types";
import { cn } from "~/lib/utils";

// Gap between the underside of the pinned nav and the heading it scrolls to.
const SCROLL_TO_GAP = 16;
// A heading counts as "current" once it passes this far under the nav.
const SPY_GAP = 24;

// Geometry for the cart button the bar grows once it pins. It starts where the
// header cart was and comes to rest in the scroll-to-top button's column, so
// these have to match the navbar: max-w-7xl there is the same 1280px as
// max-w-screen-xl here, the header cart is right-4 inside it at 2rem wide, and
// the scroll-to-top button is right-6.
const CONTENT_CAP = 1280;
const HEADER_CART_INSET = 16;
const HEADER_CART_SIZE = 32;
const BAR_CART_WIDTH = 52;
const BAR_CART_RIGHT = 24;

export default function MenuCards() {
  // useSuspenseQuery, not useQuery: the page prefetches this on the server, and
  // suspending lets the server render the finished menu into the HTML. With
  // useQuery the server rendered the spinner below while the client rendered
  // the menu, which is a hydration mismatch - React threw the server markup
  // away and re-rendered the whole page.
  const [productCategory] =
    api.dessert.getProductsForMenuByCategory.useSuspenseQuery();

  const { language } = useLanguage();
  const cart = useContext(CartContext);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDessert, setSelectedDessert] =
    useState<dessertOnClient | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dragDistance, setDragDistance] = useState(0);
  // How far the reader has come through the menu itself. It used to mirror the
  // horizontal scroll of the pill strip, which stopped meaning anything once
  // the strip started scrolling itself to keep the active pill centred.
  const [readingProgress, setReadingProgress] = useState(0);

  const animationFrameRef = useRef<number>();

  // Sticky nav: the bar lifts off the page once it reaches the top, and the
  // highlight slides to whichever category the reader has scrolled into.
  const navRef = useRef<HTMLDivElement>(null);
  const navSentinelRef = useRef<HTMLDivElement>(null);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );
  const [isNavStuck, setIsNavStuck] = useState(false);
  // Offset and width that stretch the pinned surface out to the viewport edges,
  // past the max-width wrapper the bar sits inside.
  const [bleed, setBleed] = useState<{ left: number; width: number } | null>(
    null,
  );
  const [indicator, setIndicator] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  // Clicking a category smooth-scrolls the page, which would otherwise drag the
  // highlight through every section on the way. Freeze it until the page settles.
  const suppressSpyRef = useRef(false);
  const spySettleRef = useRef<ReturnType<typeof setTimeout>>();

  // Matches the rest of the site, which only offers a cart once there is one.
  const cartQuantity = cart?.totalItems ?? 0;
  const showBarCart = isNavStuck && cartQuantity > 0;

  // Anchored on its left edge so the width grows rightward, and offset back to
  // the header cart to start from. Measured in the bar's own coordinates, not
  // the viewport's, so the button rides the bar down when it unpins instead of
  // staying stuck to the top of the screen on its own. bleed already carries
  // where the viewport edges fall relative to the bar, for the full-bleed
  // panel, so this costs no extra layout read.
  const barCart = useMemo(() => {
    const viewportLeft = bleed?.left ?? 0;
    const viewportWidth = bleed?.width ?? 0;
    const left = viewportLeft + viewportWidth - BAR_CART_RIGHT - BAR_CART_WIDTH;
    const headerCartLeft =
      viewportLeft +
      (viewportWidth + CONTENT_CAP) / 2 -
      HEADER_CART_INSET -
      HEADER_CART_SIZE;
    return { left, travel: Math.max(0, left - headerCartLeft) };
  }, [bleed?.left, bleed?.width]);

  // Filter out categories with no desserts
  const categoriesWithDesserts = useMemo(
    () =>
      productCategory?.filter((category) => category.desserts.length > 0) ?? [],
    [productCategory],
  );

  // Set the first category as active when data loads
  useEffect(() => {
    setActiveCategory((previous) =>
      previous && categoriesWithDesserts.some((c) => c.id === previous)
        ? previous
        : (categoriesWithDesserts[0]?.id ?? null),
    );
  }, [categoriesWithDesserts]);

  // A 1px sentinel sits directly above the bar: once it leaves the viewport the
  // bar is pinned, which is what the floating styling keys off.
  useEffect(() => {
    const sentinel = navSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNavStuck(!!entry && !entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [categoriesWithDesserts]);

  // Scroll spy: keep the highlighted category in step with the page.
  useEffect(() => {
    if (categoriesWithDesserts.length < 2) return;

    let frame: number | null = null;

    const update = () => {
      frame = null;
      const navHeight = navRef.current?.offsetHeight ?? 0;
      const offset = navHeight + SPY_GAP;

      // How far the pinned surface has to stretch to reach both edges of the
      // viewport. Measured rather than done with 100vw, which counts the
      // scrollbar and so overhangs the page and makes it scrollable sideways.
      const barLeft = navRef.current?.getBoundingClientRect().left ?? 0;
      const viewportWidth = document.documentElement.clientWidth;
      setBleed((previous) =>
        previous?.left === -barLeft && previous.width === viewportWidth
          ? previous
          : { left: -barLeft, width: viewportWidth },
      );

      // Empty until the first heading clears the bar, full at the foot of the
      // page — so it measures the menu, not the strip.
      const firstId = categoriesWithDesserts[0]?.id;
      const firstSection = firstId
        ? document.getElementById(`category-${firstId}`)
        : null;
      if (firstSection) {
        const start =
          firstSection.getBoundingClientRect().top + window.scrollY - navHeight;
        const span =
          document.documentElement.scrollHeight - window.innerHeight - start;
        const progress = span > 0 ? ((window.scrollY - start) / span) * 100 : 0;
        setReadingProgress(Math.max(0, Math.min(100, progress)));
      }

      // The highlight is frozen while a click-scroll is in flight, but the
      // progress bar above still tracks it the whole way.
      if (suppressSpyRef.current) return;

      let current = categoriesWithDesserts[0]?.id ?? null;
      for (const category of categoriesWithDesserts) {
        const section = document.getElementById(`category-${category.id}`);
        if (!section) continue;
        if (section.getBoundingClientRect().top - offset > 0) break;
        current = category.id;
      }

      // The last category is usually too short to ever reach the top, so give
      // it the highlight whenever the page is scrolled to the bottom.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) {
        current =
          categoriesWithDesserts[categoriesWithDesserts.length - 1]?.id ??
          current;
      }

      setActiveCategory((previous) =>
        previous === current ? previous : current,
      );
    };

    const onScroll = () => {
      if (suppressSpyRef.current) {
        // Each scroll event pushes the release out, so the spy wakes up 130ms
        // after the smooth scroll stops rather than part-way through it.
        if (spySettleRef.current) clearTimeout(spySettleRef.current);
        spySettleRef.current = setTimeout(() => {
          suppressSpyRef.current = false;
        }, 130);
      }
      if (frame === null) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [categoriesWithDesserts]);

  useEffect(() => {
    return () => {
      if (spySettleRef.current) clearTimeout(spySettleRef.current);
    };
  }, []);

  // Measure the active pill so the sliding highlight lands exactly on it.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !activeCategory) return;

    const measure = () => {
      const button = categoryButtonRefs.current[activeCategory];
      if (!button) return;
      setIndicator({
        left: button.offsetLeft,
        top: button.offsetTop,
        width: button.offsetWidth,
        height: button.offsetHeight,
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => observer.disconnect();
  }, [activeCategory, language, categoriesWithDesserts]);

  // Bring the active pill into view inside the strip. Done by hand rather than
  // with scrollIntoView, which would also yank the page vertically.
  const centreActivePill = useCallback(() => {
    const container = scrollContainerRef.current;
    const button = activeCategory
      ? categoryButtonRefs.current[activeCategory]
      : null;
    if (!container || !button) return;

    const maxScroll = container.scrollWidth - container.clientWidth;
    const centred =
      button.offsetLeft - (container.clientWidth - button.offsetWidth) / 2;
    const target = Math.max(0, Math.min(maxScroll, centred));

    if (Math.abs(target - container.scrollLeft) < 4) return;
    container.scrollTo({ left: target, behavior: "smooth" });
  }, [activeCategory]);

  useEffect(() => {
    centreActivePill();
  }, [centreActivePill]);

  const scrollToCategory = (categoryId: string) => {
    if (dragDistance > 10) {
      return;
    }

    setActiveCategory(categoryId);
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      const navHeight = navRef.current?.offsetHeight ?? 0;
      const y =
        element.getBoundingClientRect().top +
        window.scrollY -
        navHeight -
        SCROLL_TO_GAP;

      suppressSpyRef.current = true;
      if (spySettleRef.current) clearTimeout(spySettleRef.current);
      // Fallback release for when the click lands on the section we are already
      // parked at and no scroll event ever fires.
      spySettleRef.current = setTimeout(() => {
        suppressSpyRef.current = false;
      }, 400);

      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;

    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    setDragDistance(0);

    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current || startX === 0) return;

    e.preventDefault();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;

      const x = e.pageX - scrollContainerRef.current.offsetLeft;
      const walk = (x - startX) * 2;
      const distance = Math.abs(walk);

      setDragDistance(distance);

      if (distance > 5) {
        setIsDragging(true);
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
      }
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setStartX(0);
    setTimeout(() => setDragDistance(0), 100);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setStartX(0);
    setTimeout(() => setDragDistance(0), 100);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const handleOpenDialog = (dessert: dessertOnClient) => {
    setIsDialogOpen(true);
    setSelectedDessert(dessert);
  };

  if (!productCategory || productCategory.length === 0) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 rounded-lg bg-muted/30 p-8 text-center">
        <Soup className="h-16 w-16 text-muted" />
        <p className="text-xl font-medium">
          {language === "en"
            ? "Sorry, we currently have no desserts available"
            : "抱歉，我们目前没有甜点出售"}
        </p>
        <p className="text-muted-foreground">
          {language === "en"
            ? "Please check back soon for our delicious offerings"
            : "请稍后再来查看我们美味的产品"}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-secondary/20 py-8 text-center">
        {/* <div className="absolute inset-0 z-0 opacity-10">
          <div className="absolute inset-0 bg-[url('/pattern-bg.png')] bg-repeat opacity-20"></div>
        </div> */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="h-6 w-6 text-primary md:h-8 md:w-8" />
            <h1 className="font-serif text-4xl font-bold text-primary-display md:text-5xl lg:text-6xl">
              {language === "en" ? "Our Menu" : "我们的菜单"}
            </h1>
            <Sparkles className="h-6 w-6 text-primary md:h-8 md:w-8" />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {language === "en"
              ? "Discover our selection of authentic Chinese desserts, handmade with traditional ingredients"
              : "探索我们精选的正宗中式甜点，使用传统食材手工制作"}
          </p>
        </motion.div>
      </div>

      {/* Category navigation — pins to the top and follows the reader down */}

      {categoriesWithDesserts.length > 1 && (
        <>
          <div ref={navSentinelRef} aria-hidden className="h-px w-full" />
          <div ref={navRef} className="sticky top-0 z-20 mb-6 py-3">
            {/* The surface is its own layer so it can break out of the
                max-width wrapper and reach both edges of the viewport, while
                the pills and progress bar stay lined up with the cards. Only
                this layer changes on pinning — the bar keeps the same box, so
                nothing below it ever reflows. */}
            <div
              aria-hidden
              // Falls back to the width of the bar itself until measured, which
              // is only ever visible on the very first paint, before any scroll
              // has had a chance to pin it.
              style={
                bleed ? { left: bleed.left, width: bleed.width } : undefined
              }
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 right-0 border-b",
                "transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out",
                isNavStuck
                  ? "border-primary-soft/40 bg-background/85 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)] backdrop-blur-md"
                  : "border-transparent",
              )}
            />
            <div
              className={cn(
                "relative",
                // Clears the fixed hamburger, which is hidden from xl up.
                isNavStuck && "pr-[4.5rem] xl:pr-0",
              )}
            >
              <div
                ref={scrollContainerRef}
                className={cn(
                  "relative flex select-none gap-2 overflow-x-auto pb-2 md:scrollbar-hide",
                  isDragging ? "cursor-grabbing" : "cursor-grab",
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                {/* One highlight that slides between the pills, so a change of
                  section reads as movement rather than a jump. The pills stay
                  transparent so it never vanishes behind the one it passes.
                  Held back until measured, otherwise it grows out of nothing on
                  the first paint instead of simply being there. */}
                {indicator.width > 0 && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-0 rounded-xl bg-primary shadow"
                    initial={false}
                    animate={{
                      x: indicator.left,
                      y: indicator.top,
                      width: indicator.width,
                      height: indicator.height,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 320,
                      damping: 34,
                      mass: 0.7,
                    }}
                  />
                )}

                {categoriesWithDesserts.map((category) => {
                  const isActive = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      ref={(el) => {
                        categoryButtonRefs.current[category.id] = el;
                      }}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "relative inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        isActive
                          ? "border-transparent text-primary-foreground"
                          : "border-input bg-transparent text-foreground shadow-sm hover:border-primary/40 hover:bg-primary/10",
                      )}
                      onClick={() => scrollToCategory(category.id)}
                      style={{ pointerEvents: isDragging ? "none" : "auto" }}
                    >
                      {language === "en" ? category.name : category.chineseName}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 hidden h-1 w-full overflow-hidden rounded-full bg-muted md:block">
                {/* No CSS transition: this is recomputed every scroll frame,
                    and easing it would only make it trail the page. */}
                <div
                  className="h-full bg-primary"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>
            </div>

            {/* 2xl and up only: that is exactly where the floating View Cart
                button is hidden and the header cart has scrolled out of reach,
                so the pinned bar is the only cart left. Below it the floating
                button is already on screen.

                Positioned against the bar rather than the pill strip so it can
                come to rest in the scroll-to-top button's column, clear of the
                max-width content the pills live in — but still inside the bar,
                so it travels down with it when the bar unpins instead of
                breaking away and sliding off on its own. It arrives from where
                the header cart was, left to right, growing from nothing as it
                goes, which reads as the cart moving into the bar rather than a
                button blinking into place. */}
            <motion.button
              type="button"
              tabIndex={showBarCart ? undefined : -1}
              aria-hidden={!showBarCart}
              onClick={() => cart?.setIsCartOpen(true)}
              aria-label={
                language === "en"
                  ? `View cart, ${cartQuantity} ${cartQuantity === 1 ? "item" : "items"}`
                  : `查看购物车，${cartQuantity} 件商品`
              }
              initial={false}
              style={{
                left: barCart.left,
                pointerEvents: showBarCart ? "auto" : "none",
              }}
              animate={{
                x: showBarCart ? 0 : -barCart.travel,
                width: showBarCart ? BAR_CART_WIDTH : 0,
                opacity: showBarCart ? 1 : 0,
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute top-3 hidden h-9 items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-primary px-0 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary-display focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring 2xl:flex"
            >
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="shrink-0">{cartQuantity}</span>
            </motion.button>
          </div>
        </>
      )}

      {/* Menu categories and items */}
      <div className="mb-20 space-y-16">
        {categoriesWithDesserts.map((category) => (
          <motion.div
            key={category.id}
            id={`category-${category.id}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 flex items-center">
              <div className="h-px flex-grow bg-primary/20"></div>
              <h2 className="mx-4 text-2xl font-bold text-primary-display underline md:text-3xl">
                {language === "en" ? category.name : category.chineseName}
              </h2>
              <div className="h-px flex-grow bg-primary/20"></div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 md:px-2 lg:grid-cols-4">
              {category.desserts.map((dessert) => {
                const discountedAmountInCents = dessert.promo
                  ? dessert.promo.type === "FIXED_AMOUNT"
                    ? dessert.promo.value
                    : Math.floor(
                        dessert.priceInCents * (dessert.promo.value / 100),
                      )
                  : 0;

                const priceInCentsAfterPromo =
                  dessert.priceInCents - discountedAmountInCents;
                return (
                  <motion.div
                    key={dessert.id}
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Card className="flex h-full flex-col overflow-hidden border-2 border-transparent transition-all hover:border-secondary hover:shadow-lg">
                      <div className="group relative aspect-square w-full overflow-hidden">
                        <Image
                          src={
                            dessert.imagePath ??
                            (process.env.NEXT_PUBLIC_FILLER_IMAGE_URL as string)
                          }
                          alt={
                            language === "en"
                              ? dessert.name
                              : dessert.chineseName
                          }
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                          <p
                            className="text-sm font-medium text-white drop-shadow-lg hover:cursor-pointer"
                            onClick={() =>
                              handleOpenDialog({
                                ...dessert,
                                categoryId: category.id,
                              })
                            }
                          >
                            {language === "en" ? "Customise" : "定制"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col">
                        <CardHeader className="space-y-2 pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base md:text-xl">
                              {language === "en"
                                ? dessert.name
                                : dessert.chineseName}
                            </CardTitle>
                            {/* {dessert.isHot && (
                            <Badge
                              variant="outline"
                              className="bg-red-100 text-red-600"
                            >
                              {language === "en" ? "Hot" : "热"}
                            </Badge>
                          )}
                          {dessert.isCold && (
                            <Badge
                              variant="outline"
                              className="bg-blue-100 text-blue-600"
                            >
                              {language === "en" ? "Cold" : "冷"}
                            </Badge>
                          )} */}
                          </div>
                          <CardDescription className="line-clamp-2 text-[0.70rem] md:text-xs">
                            {language === "en"
                              ? dessert.ingredients
                                  .map((i) => i.name)
                                  .join(" • ")
                              : dessert.ingredients
                                  .map((ingredient) => ingredient.chineseName)
                                  .join(" • ")}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="mt-auto pt-4">
                          <Button
                            // Tighter gutters on mobile: the two-column cards
                            // leave a ~117px button, and a discounted price
                            // sits two values wide inside it.
                            className="flex w-full items-center justify-center gap-2 px-2 md:px-4"
                            onClick={() =>
                              handleOpenDialog({
                                ...dessert,
                                categoryId: category.id,
                              })
                            }
                          >
                            {dessert.promo ? (
                              <>
                                {/*
                                 * Both prices sit on the caramel button, where
                                 * the grey-and-red pair was invisible rather
                                 * than merely faint: red-600 measured 1.01:1
                                 * against it and the grey 1.09:1 — the same
                                 * luminance as the background. White carries
                                 * the old price at 4.88:1, and the sale price
                                 * moves onto the brand peach, 12.9:1 against
                                 * its own near-black and 3.5:1 against the
                                 * button it sits on.
                                 */}
                                {/* Old price */}
                                <span className="relative text-sm text-primary-foreground">
                                  {formatCurrency(dessert.priceInCents / 100)}
                                  <span className="pointer-events-none absolute left-0 top-1/2 h-[1.5px] w-full rotate-[-8deg] bg-red-500" />
                                </span>

                                {/* New price */}
                                <span className="rounded-md text-base font-semibold text-red-600">
                                  {formatCurrency(priceInCentsAfterPromo / 100)}
                                </span>
                              </>
                            ) : (
                              <span>
                                {formatCurrency(dessert.priceInCents / 100)}
                              </span>
                            )}
                          </Button>
                        </CardFooter>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {isDialogOpen && selectedDessert && (
        <CustomisationDialog
          customOpen={isDialogOpen}
          setCustomOpen={setIsDialogOpen}
          dessert={selectedDessert}
          onClose={() => setSelectedDessert(null)}
        />
      )}
    </div>
  );
}
