"use client";

import { api } from "~/trpc/react";
import Image from "next/image";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
// Loader2 dropped: the inline loading branch it belonged to is gone, the
// page's Suspense boundary owns that state now.
import { Plus, Soup } from "lucide-react";
import CustomisationDialog from "./customisation";
import { useLanguage } from "~/app/components/language";
import {
  DessertPrice,
  dessertButtonLabel,
} from "~/app/components/dessertPrice";
import { ItemName } from "~/app/components/itemName";
import { motion } from "framer-motion";
import { dessertOnClient } from "~/lib/types";
import { cn } from "~/lib/utils";
import { scrollBehavior } from "~/lib/scrollBehavior";

// Gap between the underside of the pinned nav and the heading it scrolls to.
const SCROLL_TO_GAP = 16;
// A heading counts as "current" once it passes this far under the nav.
const SPY_GAP = 24;

export default function MenuCards() {
  // useSuspenseQuery, not useQuery: the page prefetches this on the server, and
  // suspending lets the server render the finished menu into the HTML. With
  // useQuery the server rendered the spinner below while the client rendered
  // the menu, which is a hydration mismatch - React threw the server markup
  // away and re-rendered the whole page.
  const [productCategory] =
    api.dessert.getProductsForMenuByCategory.useSuspenseQuery();

  const { language } = useLanguage();
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
    container.scrollTo({ left: target, behavior: scrollBehavior() });
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

      window.scrollTo({ top: Math.max(0, y), behavior: scrollBehavior() });
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
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <span className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Soup className="h-9 w-9 text-muted-foreground" aria-hidden />
        </span>
        <p className="text-xl font-extrabold">
          {language === "en"
            ? "Sorry, we currently have no desserts available"
            : "抱歉，我们目前没有甜点出售"}
        </p>
        <p className="text-[15px] text-muted-foreground">
          {language === "en"
            ? "Please check back soon for our delicious offerings"
            : "请稍后再来查看我们美味的产品"}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-2 pb-3 pt-2 md:pb-5 md:pt-10"
      >
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.01em] md:text-5xl md:leading-[1.05]">
          {language === "en" ? "Menu" : "我们的菜单"}
        </h1>
        <p className="hidden text-[17px] text-muted-foreground md:block">
          {language === "en"
            ? "Discover our selection of authentic Chinese desserts, handmade with traditional ingredients"
            : "探索我们精选的正宗中式甜点，使用传统食材手工制作"}
        </p>
      </motion.div>

      {/* Category navigation — pins to the top and follows the reader down */}

      {categoriesWithDesserts.length > 1 && (
        <>
          <div ref={navSentinelRef} aria-hidden className="h-px w-full" />
          <div ref={navRef} className="sticky top-0 z-20 pb-2.5 pt-3">
            {/* The surface is its own layer so it can break out of the
                max-width wrapper and reach both edges of the viewport, while
                the pills and progress bar stay lined up with the rows. Only
                this layer changes on pinning: the bar keeps the same box, so
                nothing below it ever reflows. A hairline always, as drawn;
                pinned, the cream turns translucent over what scrolls under it. */}
            <div
              aria-hidden
              // Falls back to the width of the bar itself until measured, which
              // is only ever visible on the very first paint, before any scroll
              // has had a chance to pin it.
              style={
                bleed ? { left: bleed.left, width: bleed.width } : undefined
              }
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 right-0 border-b border-border",
                "transition-[background-color,backdrop-filter] duration-300 ease-out",
                isNavStuck
                  ? "bg-background/90 backdrop-blur-md"
                  : "bg-background",
              )}
            />
            <div className="relative">
              <div
                ref={scrollContainerRef}
                // `isolate` so each pill's peach, drawn below the sliding ink
                // highlight, stays above the page rather than behind it.
                className={cn(
                  "relative isolate flex select-none gap-2 overflow-x-auto scrollbar-hide",
                  isDragging ? "cursor-grabbing" : "cursor-grab",
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                {/* One highlight that slides between the pills, so a change of
                  section reads as movement rather than a jump. It runs over
                  the pills' peach and under their labels, so it never vanishes
                  behind the one it passes. Held back until measured, otherwise
                  it grows out of nothing on the first paint instead of simply
                  being there. */}
                {indicator.width > 0 && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-0 rounded-full bg-inverse"
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
                      className="relative flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-11 md:px-[18px]"
                      onClick={() => scrollToCategory(category.id)}
                      style={{ pointerEvents: isDragging ? "none" : "auto" }}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 -z-10 rounded-full bg-secondary"
                      />
                      <ItemName
                        name={category.name}
                        chineseName={category.chineseName}
                        layout="inline"
                        className="flex-nowrap gap-x-1.5 md:gap-x-2"
                        leadClassName={cn(
                          "text-sm md:text-[15px]",
                          isActive
                            ? "font-bold text-secondary"
                            : "font-semibold text-foreground",
                        )}
                        secondClassName={cn(
                          "text-[13px] md:text-sm",
                          isActive ? "text-secondary" : "text-accent",
                        )}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 hidden h-[3px] w-full overflow-hidden rounded-full bg-muted md:block">
                {/* No CSS transition: this is recomputed every scroll frame,
                    and easing it would only make it trail the page. */}
                <div
                  className="h-full bg-primary"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Menu categories and items: rows divided by hairlines, two columns from md. */}
      <div className="mb-20 flex flex-col gap-6 pt-4 md:gap-12 md:pt-8">
        {categoriesWithDesserts.map((category) => (
          <motion.section
            key={category.id}
            id={`category-${category.id}`}
            aria-labelledby={`category-heading-${category.id}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 id={`category-heading-${category.id}`} className="pb-1 md:pb-2">
              <ItemName
                name={category.name}
                chineseName={category.chineseName}
                layout="inline"
                className="justify-between gap-x-3.5 md:justify-start"
                leadClassName="text-[26px] font-extrabold leading-tight md:text-[32px]"
                secondClassName="text-lg text-accent md:text-[22px]"
              />
            </h2>

            <ul className="grid grid-cols-1 md:grid-cols-2 md:gap-x-14">
              {category.desserts.map((dessert) => (
                <li key={dessert.id} className="border-b border-border">
                  <button
                    type="button"
                    aria-label={dessertButtonLabel(dessert, language)}
                    onClick={() =>
                      handleOpenDialog({
                        ...dessert,
                        categoryId: category.id,
                      })
                    }
                    className="group flex w-full items-center gap-3.5 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:gap-[18px] md:py-[18px]"
                  >
                    <span className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-full bg-muted md:h-[104px] md:w-[104px]">
                      <Image
                        src={
                          dessert.imagePath ??
                          (process.env.NEXT_PUBLIC_FILLER_IMAGE_URL as string)
                        }
                        alt=""
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="104px"
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-[3px]">
                      <ItemName
                        name={dessert.name}
                        chineseName={dessert.chineseName}
                        leadClassName="text-[17px] leading-snug md:text-lg"
                        secondClassName="text-[15px]"
                      />
                      {dessert.ingredients.length > 0 && (
                        <span className="truncate text-[13px] text-muted-foreground md:text-sm">
                          {dessert.ingredients
                            .map((i) =>
                              language === "en" ? i.name : i.chineseName,
                            )
                            .join(language === "en" ? ", " : "、")}
                        </span>
                      )}
                      <DessertPrice
                        dessert={dessert}
                        language={language}
                        className="mt-[3px] md:mt-1"
                        priceClassName="text-base md:text-[17px]"
                      />
                    </span>
                    <span
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[filter] group-hover:brightness-95"
                    >
                      <Plus className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
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
