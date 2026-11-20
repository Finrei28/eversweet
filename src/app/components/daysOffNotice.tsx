"use client";

import { CalendarX2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { closureLabel, closures } from "~/lib/pickUpLabels";

/**
 * The notice of the days the shop will be closed, shown once per visit on the customer
 * pages while any lie ahead.
 *
 * Each closure is a line: one day, or a run of days by its first and last, read on the
 * Auckland calendar. The notice used to list every day as "24/12" off the browser's own
 * clock, so a visitor west of Auckland was told the day before, and a fortnight's closure
 * was fourteen dates in a sentence.
 *
 * It stays open until it is closed: a click outside does nothing, as before.
 */
export function DaysOffNotice({ daysOff }: { daysOff: readonly Date[] }) {
  const { language } = useLanguage();
  const en = language === "en";
  const [open, setOpen] = useState(true);
  const spells = useMemo(() => closures(daysOff), [daysOff]);

  if (spells.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        closeLabel={en ? "Close" : "关闭"}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-h-[calc(100dvh-40px)] w-[calc(100%-40px)] max-w-md gap-0 overflow-y-auto rounded-card border-border bg-card p-6 sm:p-8"
      >
        <span
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-secondary"
          aria-hidden
        >
          <CalendarX2 className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <DialogTitle className="mt-4 text-[22px] font-extrabold leading-tight tracking-normal">
          {en ? "Announcement" : "通知"}
        </DialogTitle>
        <DialogDescription className="mt-2 text-base text-foreground">
          {en ? "We will be closed on:" : "我们将于以下日期休息："}
        </DialogDescription>
        <ul className="mt-3 divide-y divide-border rounded-[14px] bg-muted px-4">
          {spells.map((spell) => {
            const { days, joiner } = closureLabel(spell, language);
            return (
              <li key={spell.first} className="py-3 text-base font-bold">
                {days.map((day, index) => (
                  <Fragment key={day}>
                    {index > 0 && joiner}
                    <span className="whitespace-nowrap">{day}</span>
                  </Fragment>
                ))}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[15px] text-muted-foreground">
          {en
            ? "Sorry for the inconvenience! We will be open as usual on all other days. Thank you for your understanding!"
            : "对于由此带来的不便，我们深表歉意！除上述日期外，我们将照常营业。感谢您的理解！"}
        </p>
        <DialogClose asChild>
          <Button size="pill" className="mt-6 w-full">
            {en ? "Close" : "关闭"}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
