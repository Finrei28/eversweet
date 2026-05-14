"use client";

import { useLanguage } from "~/app/components/language";

export default function OpeningHours() {
  const { language } = useLanguage();
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
            {[
              {
                day: `${language === "en" ? "Monday" : "星期一"}`,
                hours: "12:30 PM - 9:30 PM",
              },
              {
                day: `${language === "en" ? "Tuesday" : "星期二"}`,
                hours: "12:30 PM - 9:30 PM",
              },
              {
                day: `${language === "en" ? "Wednesday" : "星期三"}`,
                hours: "12:30 PM - 9:30 PM",
                // hours: `${language === "en" ? "Closed" : "休息日"}`,
              },
              {
                day: `${language === "en" ? "Thursday" : "星期四"}`,
                hours: "12:30 PM - 9:30 PM",
              },
              {
                day: `${language === "en" ? "Friday" : "星期五"}`,
                hours: "12:00 PM - 10:00 PM",
              },
              {
                day: `${language === "en" ? "Saturday" : "星期六"}`,
                hours: "12:00 PM - 10:00 PM",
              },
              {
                day: `${language === "en" ? "Sunday" : "星期日"}`,
                hours: "12:00 PM - 10:00 PM",
              },
            ].map(({ day, hours }, index) => (
              <tr key={index} className="border-b border-gray-300">
                <td className="px-4 py-3 font-semibold text-gray-800">{day}</td>
                <td className="px-4 py-3 text-gray-600">{hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
