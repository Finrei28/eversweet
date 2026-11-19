"use client";

import { useState, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";

import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetTitle,
} from "~/components/ui/sheet";

const BOARDS = ["/Eversweet_new_menu1.jpg", "/Eversweet_new_menu2.jpg"];

interface MenuProps {
  /** Attached to the menu boards, in order, so falling desserts can land on them. */
  imageRefs?: RefObject<HTMLDivElement>[];
}

/**
 * The two menu boards from the shop, each opening full size. The full-size view is a
 * sheet in the middle of the screen, so Escape and the scrim close it and focus comes
 * back to the board it opened from; it was a hand-made overlay whose close button only
 * appeared from `lg`.
 */
export default function Menu({ imageRefs }: MenuProps) {
  const { language } = useLanguage();
  const en = language === "en";
  const [selected, setSelected] = useState<number | null>(null);
  const boardName = (index: number) =>
    en ? `Eversweet menu board ${index + 1}` : `Eversweet 菜单牌 ${index + 1}`;

  return (
    <section className="border-t border-border">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-5 py-10 lg:gap-7 lg:py-[72px]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-extrabold lg:text-[32px]">
              {en ? "Our menu" : "我们的菜单"}
            </h2>
            <p className="text-[15px] text-muted-foreground lg:text-[17px]">
              {en
                ? "The menu boards in the shop. Select one to see it full size."
                : "店里的菜单牌。点选一张可查看大图。"}
            </p>
          </div>
          <Button asChild size="cta" className="hidden px-8 lg:inline-flex">
            <Link href="/menu">{en ? "Order now" : "立即点菜"}</Link>
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
          {BOARDS.map((src, index) => (
            <div key={src} ref={imageRefs?.[index]}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={
                  en
                    ? `See menu board ${index + 1} full size`
                    : `查看第 ${index + 1} 张菜单牌大图`
                }
                className="block w-full overflow-hidden rounded-[16px] border border-border bg-card transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:rounded-card"
              >
                <Image
                  src={src}
                  alt={boardName(index)}
                  width={4961}
                  height={3509}
                  sizes="(min-width: 1024px) 600px, 100vw"
                  className="block aspect-[4961/3509] h-auto w-full object-cover"
                />
              </button>
            </div>
          ))}
        </div>

        <Button asChild size="cta" className="w-full lg:hidden">
          <Link href="/menu">{en ? "Order now" : "立即点菜"}</Link>
        </Button>
      </div>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent
          side="center"
          aria-describedby={undefined}
          className="w-auto max-w-[calc(100vw-32px)] bg-transparent"
        >
          {selected !== null && (
            <>
              <SheetTitle className="sr-only">{boardName(selected)}</SheetTitle>
              <Image
                src={BOARDS[selected]!}
                alt={boardName(selected)}
                width={4961}
                height={3509}
                sizes="95vw"
                className="h-auto max-h-[calc(100dvh-48px)] w-auto max-w-full rounded-card object-contain"
                draggable={false}
              />
              <SheetCloseButton
                label={en ? "Close" : "关闭"}
                className="absolute right-3 top-3"
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
