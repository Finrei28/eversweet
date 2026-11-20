import { describe, expect, it } from "vitest";

import { LEGAL_LAST_UPDATED, termAndConditions } from "./legalDocuments";

/**
 * The Terms say how delivery works: only through the platforms the shop is on, and orders there
 * are between the customer and that platform. The home page offers Uber Eats, DoorDash and
 * HungryPanda, so the Terms name all three wherever they speak of delivery.
 *
 * Website-only on purpose: `legalDocuments.test.ts` is a byte-for-byte copy of the order
 * server's, and the delivery platforms are this site's concern.
 */
const PLATFORMS = ["Uber Eats", "DoorDash", "HungryPanda"];

const sectionText = (heading: string): string => {
  const section = termAndConditions.sections.find((s) =>
    s.heading.includes(heading),
  );
  if (!section) throw new Error(`no section "${heading}"`);
  return [section.content ?? "", ...(section.list ?? [])].join("\n");
};

describe("the Terms on delivery", () => {
  it("names every platform where they say delivery is only through them", () => {
    const collecting = sectionText("Collecting your order");
    const line = collecting
      .split("\n")
      .find((l) => l.startsWith("Delivery is available only through"));
    expect(line).toBeDefined();
    for (const platform of PLATFORMS) expect(line).toContain(platform);
  });

  it("names every platform where they disclaim orders placed through them", () => {
    const line = termAndConditions.sections
      .flatMap((s) => s.list ?? [])
      .find((l) =>
        l.startsWith("We are not responsible for orders placed through"),
      );
    expect(line).toBeDefined();
    for (const platform of PLATFORMS) expect(line).toContain(platform);
  });

  it("is dated the day that wording changed", () => {
    expect(LEGAL_LAST_UPDATED).toBe("20 November 2026");
  });
});
