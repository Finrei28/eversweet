export default function OpeningHours() {
  return (
    <section className="p-8 text-center">
      <h2 className="mb-4 text-3xl font-bold text-gray-900">Opening Hours</h2>
      <p className="mb-6 text-gray-600">
        Come visit us during our working hours!
      </p>

      <div className="overflow-x-auto">
        <table className="mx-auto w-full max-w-md border-collapse">
          <tbody>
            {[
              { day: "Monday", hours: "10:00 AM - 6:00 PM" },
              { day: "Tuesday", hours: "10:00 AM - 6:00 PM" },
              { day: "Wednesday", hours: "10:00 AM - 6:00 PM" },
              { day: "Thursday", hours: "10:00 AM - 6:00 PM" },
              { day: "Friday", hours: "10:00 AM - 6:00 PM" },
              { day: "Saturday", hours: "10:00 AM - 6:00 PM" },
              { day: "Sunday", hours: "Closed" },
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
