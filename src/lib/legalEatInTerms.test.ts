import { describe, expect, it } from "vitest";

import { LEGAL_LAST_UPDATED, termAndConditions } from "./legalDocuments";

/**
 * The Terms say what ordering to eat in asks of a customer: arrive by the time on the order,
 * the shop is not responsible for an eat-in order that spoils while it waits for a late
 * customer, and after 15 minutes the table may go to someone else. The owner approved this
 * wording on 2026-11-21, so it is pinned word for word.
 *
 * - **It sits at the end of section 9**, beside the pick-up and last-eat-in lines, so no
 *   section is renumbered.
 * - **The first line says eating in is ordered in the app.** Section 9 applies to both
 *   platforms, and `appliesTo` cannot be set on one bullet. The website writes every order
 *   with `dineIn: false`, and the app takes eat-in for the same day only.
 * - **Nothing books a table.** No reservation feature exists in either repo; the eat-in order
 *   is the only way to arrange eating in. So the table line promises no table, only that one
 *   may be given away.
 *
 * Website-only, like `legalDeliveryTerms.test.ts`: `legalDocuments.test.ts` is copied from the
 * order server and is the shape, not the wording. `verify:legal` keeps the order server's
 * copy of the document identical, so one pin covers both.
 */
const EAT_IN_LINES = [
  "Eating in is ordered in the app, for the same day. If you order to eat in, it is up to you to arrive on time: by the time you chose, or, if you chose as soon as possible, by the estimated eat-in time shown on your order.",
  "We prepare an eat-in order for that time. If you arrive late and it has melted, gone cold or spoiled while it waited, we are not responsible for that, and we do not replace or refund it.",
  "We cannot keep a table free for long. If you arrive more than 15 minutes after your eat-in time, we may give the table to other customers, and you may have to wait for one to come free.",
];

const collecting = () => {
  const section = termAndConditions.sections.find(
    (s) => s.heading === "9. Collecting your order",
  );
  if (!section) throw new Error('no section "9. Collecting your order"');
  return section;
};

describe("the Terms on eating in", () => {
  it("ends section 9 with the three eat-in lines, in order", () => {
    expect(collecting().list?.slice(-EAT_IN_LINES.length)).toEqual(
      EAT_IN_LINES,
    );
  });

  it("leaves section 9 for both platforms, since the lines name the app themselves", () => {
    expect(collecting().appliesTo).toBeUndefined();
  });

  it("states the eat-in rules nowhere else, so no section is added or renumbered", () => {
    const elsewhere = termAndConditions.sections
      .filter((s) => s.heading !== "9. Collecting your order")
      .flatMap((s) => [s.content ?? "", ...(s.list ?? [])])
      .filter((text) => /eat-in time|give the table/.test(text));
    expect(elsewhere).toEqual([]);
    expect(termAndConditions.sections.at(-1)?.heading).toBe("20. Contact us");
  });

  // No earlier, rather than exactly: every later change to the Terms moves the date on, as
  // LEGAL_LAST_UPDATED says to. The minimum-spend offers clause did on 2026-11-23.
  it("is dated no earlier than the day that wording was added", () => {
    expect(
      new Date(`${LEGAL_LAST_UPDATED} UTC`).getTime(),
    ).toBeGreaterThanOrEqual(Date.UTC(2026, 10, 21));
  });
});
