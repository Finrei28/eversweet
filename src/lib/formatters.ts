const Currency_Formatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number) {
  return Currency_Formatter.format(amount);
}

const Number_Formatter = new Intl.NumberFormat("en-NZ");

export function formatNumber(amount: number) {
  return Number_Formatter.format(amount);
}

/**
 * Both formatters below name the Auckland clock explicitly. Without a `timeZone`, Intl
 * formats in the runtime's own zone - and the order confirmation email is rendered on
 * Vercel, in UTC, so an 8:29 PM pick-up was emailed as 8:29 AM.
 */
export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
};

/** A pick-up time, e.g. "17/09/2026, 8:29 pm", on the Auckland clock. */
export const getCollectionTime = (date: Date) => {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
};
