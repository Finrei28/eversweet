"use client";

import { useLanguage } from "~/app/components/language";
import { formatMinutes, LAST_PICK_UP_OFFSET_MINUTES } from "~/lib/pickUpTimes";
import { api } from "~/trpc/react";

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

/**
 * The weekly hours, read from the same `TradingHours` table checkout uses. These were
 * hard-coded strings, one of five copies of the hours that had to be kept in step by hand.
 */
export default function OpeningHours() {
  const { language } = useLanguage();
  const { data: rows, isError } = api.store.getTradingHours.useQuery();

  return (
    <section className="p-8 text-center text-primary">
      <h2 className="mb-4 text-3xl font-bold">
        {language === "en" ? "Opening Hours" : "营业时间"}
      </h2>
      <p className="mb-6 text-gray-600">
        {language === "en"
          ? "Come visit us during our working hours!"
          : "在我们的工作时间内来访问我们！"}
      </p>

      <div className="overflow-x-auto">
        <table className="mx-auto w-full max-w-md border-collapse">
          <tbody>
            {DAYS.map(({ weekday, en, zh }) => {
              const row = rows?.find((r) => r.weekday === weekday);
              const hours = !rows
                ? isError
                  ? "-"
                  : "..."
                : row?.opensAt != null && row.closesAt != null
                  ? `${formatMinutes(row.opensAt)} - ${formatMinutes(row.closesAt)}`
                  : language === "en"
                    ? "Closed"
                    : "休息日";

              return (
                <tr key={weekday} className="border-b border-gray-300">
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {language === "en" ? en : zh}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{hours}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-gray-600">
        {language === "en"
          ? `Last pick-up is ${LAST_PICK_UP_OFFSET_MINUTES} minutes before closing.`
          : `最后取货时间为打烊前${LAST_PICK_UP_OFFSET_MINUTES}分钟。`}
      </p>
    </section>
  );
}
