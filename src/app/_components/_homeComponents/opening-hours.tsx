"use client";

import { useLanguage } from "~/app/components/language";
import { Badge } from "~/components/ui/badge";
import { useHydrated } from "~/lib/browserState";
import { LAST_PICK_UP_OFFSET_MINUTES, nzDayKey } from "~/lib/pickUpTimes";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { timeOfDay } from "~/lib/openToday";

/** Monday first, as the shop lists them. Weekday numbers are getDay()'s: 0 = Sunday. */
const DAYS = [
  { weekday: 1, en: "Monday", zh: "星期一" },
  { weekday: 2, en: "Tuesday", zh: "星期二" },
  { weekday: 3, en: "Wednesday", zh: "星期三" },
  { weekday: 4, en: "Thursday", zh: "星期四" },
  { weekday: 5, en: "Friday", zh: "星期五" },
  { weekday: 6, en: "Saturday", zh: "星期六" },
  { weekday: 0, en: "Sunday", zh: "星期日" },
];

/** Today's weekday in Auckland, wherever the browser is. */
const aucklandWeekday = (now: Date) => {
  const [year, month, day] = nzDayKey(now).split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day)).getUTCDay();
};

/**
 * The weekly hours, read from the same `TradingHours` table checkout uses. These were
 * hard-coded strings, one of five copies of the hours that had to be kept in step by hand.
 *
 * Today's row is marked once the page has hydrated: which day it is depends on when the
 * page is read, and the server's answer could be a day out from the browser's.
 */
export default function OpeningHours() {
  const { language } = useLanguage();
  const en = language === "en";
  const hydrated = useHydrated();
  const { data: rows, isError } = api.store.getTradingHours.useQuery();
  const today = hydrated ? aucklandWeekday(new Date()) : null;

  return (
    <div className="mx-auto grid w-full max-w-[1240px] gap-3 px-5 pb-12 pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:pb-[88px] lg:pt-[72px]">
      <div className="flex flex-col gap-1.5 lg:gap-2.5">
        <h2 className="text-2xl font-extrabold lg:text-[32px]">
          {en ? "Opening hours" : "营业时间"}
        </h2>
        <p className="text-[15px] text-muted-foreground lg:text-[17px]">
          {en
            ? "Come and see us during our opening hours."
            : "在我们的工作时间内来访问我们！"}
        </p>
        <p className="mt-3 hidden text-[15px] text-muted-foreground lg:block">
          {en
            ? `Last pick-up is ${LAST_PICK_UP_OFFSET_MINUTES} minutes before closing.`
            : `最后取货时间为打烊前${LAST_PICK_UP_OFFSET_MINUTES}分钟。`}
        </p>
      </div>

      <div>
        <ul className="flex flex-col">
          {DAYS.map(({ weekday, en: dayEn, zh: dayZh }) => {
            const row = rows?.find((r) => r.weekday === weekday);
            const isToday = weekday === today;
            const hours = !rows
              ? isError
                ? "-"
                : "..."
              : row?.opensAt != null && row.closesAt != null
                ? `${timeOfDay(row.opensAt, language)} – ${timeOfDay(row.closesAt, language)}`
                : en
                  ? "Closed"
                  : "休息日";

            return (
              <li
                key={weekday}
                className="flex items-center justify-between gap-4 border-b border-border py-3.5 text-base last:border-b-0 lg:py-4 lg:text-[17px]"
              >
                <span
                  className={cn(
                    "flex items-center gap-2 lg:gap-2.5",
                    isToday ? "font-extrabold" : "font-semibold",
                  )}
                >
                  {en ? dayEn : dayZh}
                  {isToday && (
                    <Badge variant="soft">{en ? "Today" : "今天"}</Badge>
                  )}
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    isToday ? "font-bold" : "text-muted-foreground",
                  )}
                >
                  {hours}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3.5 text-sm text-muted-foreground lg:hidden">
          {en
            ? `Last pick-up is ${LAST_PICK_UP_OFFSET_MINUTES} minutes before closing.`
            : `最后取货时间为打烊前${LAST_PICK_UP_OFFSET_MINUTES}分钟。`}
        </p>
      </div>
    </div>
  );
}
