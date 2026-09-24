import type { Metadata } from "next";

import LegalDocumentPage from "~/app/components/legalDocument";
import { termAndConditions } from "~/lib/legalDocuments";

export const metadata: Metadata = {
  title: "Terms & Conditions | Eversweet",
  description:
    "The terms you agree to when you order from Eversweet online or in the app.",
  alternates: { canonical: "/terms-and-conditions" },
};

/**
 * This page did not exist until now, while the checkout told customers - in both languages
 * - that completing a purchase meant agreeing to a "Terms of Service". The only terms that
 * existed were the app's, served from the order server, with no URL on this site to reach
 * them.
 *
 * The document is shared byte-for-byte with the order server; see `~/lib/legalDocuments`.
 */
export default function TermsAndConditionsPage() {
  return <LegalDocumentPage document={termAndConditions} />;
}
