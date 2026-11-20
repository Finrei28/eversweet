import { describe, expect, it } from "vitest";

import { formatPhoneNumber } from "./phoneNumber";

/**
 * The order page printed a phone number as it was stored. The checkout sends the digits
 * `react-phone-input-2` gives it - country code, no "+" - so a customer who typed
 * +64 9 949 1050 saw "6499491050" on the page and on the printed receipt.
 */
describe("formatPhoneNumber", () => {
  it("writes a website order's stored digits as a New Zealand number", () => {
    expect(formatPhoneNumber("6499491050")).toBe("09 949 1050");
    expect(formatPhoneNumber("64211231232")).toBe("021 123 1232");
  });

  it("writes an app order's international number the same way", () => {
    expect(formatPhoneNumber("+6499491050")).toBe("09 949 1050");
    expect(formatPhoneNumber("+64 21 123 1232")).toBe("021 123 1232");
  });

  it("keeps a number already written the New Zealand way", () => {
    expect(formatPhoneNumber("021 123 1232")).toBe("021 123 1232");
    expect(formatPhoneNumber("0211231232")).toBe("021 123 1232");
  });

  it("writes a number from another country with its country code", () => {
    expect(formatPhoneNumber("+61412345678")).toBe("+61 412 345 678");
  });

  it("leaves a number it cannot read as it was stored", () => {
    expect(formatPhoneNumber("12")).toBe("12");
    expect(formatPhoneNumber("not a number")).toBe("not a number");
    expect(formatPhoneNumber("")).toBe("");
    // Bare digits are read as a New Zealand number, which is all the checkout accepts.
    expect(formatPhoneNumber("61412345678")).toBe("61412345678");
  });
});
