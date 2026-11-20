import parsePhoneNumberFromString from "libphonenumber-js";

/**
 * A stored phone number, written the way a customer would write it: "09 949 1050" for a
 * New Zealand number, "+61 412 345 678" for any other.
 *
 * The two channels store it differently. The website's checkout sends the digits
 * `react-phone-input-2` gives it, country code first and no "+" ("6499491050"); the app
 * stores "+64...". Both are read with New Zealand as the default country, as the checkout
 * validated them: its input offers only New Zealand, so bare digits from it are always a
 * New Zealand number. Anything that does not read as a valid number is shown as it was
 * stored rather than dropped.
 */
export const formatPhoneNumber = (stored: string): string => {
  const phone = parsePhoneNumberFromString(stored, "NZ");
  if (!phone?.isValid()) return stored;
  return phone.country === "NZ"
    ? phone.formatNational()
    : phone.formatInternational();
};
