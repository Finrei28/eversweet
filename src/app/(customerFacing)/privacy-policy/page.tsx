import type { Metadata } from "next";

import LegalDocumentPage from "~/app/components/legalDocument";
import { privacyPolicy } from "~/lib/legalDocuments";

export const metadata: Metadata = {
  title: "Privacy Policy | Eversweet",
  description:
    "How Eversweet collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy-policy" },
};

/**
 * The policy itself lives in `~/lib/legalDocuments`, shared byte-for-byte with the order
 * server so that the app and this site cannot say different things. See that file, and
 * `npm run verify:legal`.
 *
 * This page used to hold 234 lines of hand-written prose whose "Last Updated" line was
 * `new Date()` - so it claimed to have been updated today, every day, which is the one
 * thing such a line must not do.
 */
export default function PrivacyPolicyPage() {
  return <LegalDocumentPage document={privacyPolicy} />;
}
