const Currency_Formatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 0,
});

export function formatCurrency(amount: number) {
  return Currency_Formatter.format(amount);
}

const Number_Formatter = new Intl.NumberFormat("en-NZ");

export function formatNumber(amount: number) {
  return Number_Formatter.format(amount);
}
