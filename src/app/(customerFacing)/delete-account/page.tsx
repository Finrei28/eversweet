import type { Metadata } from "next";
import Link from "next/link";

import {
  DOC_LINK,
  DOC_LIST,
  DOC_STEPS,
  DOC_TEXT,
  DocumentPage,
  DocumentSection,
} from "~/app/components/documentPage";
import { getShopProfile } from "~/server/shopProfile";

export const metadata: Metadata = {
  title: "Delete your account | Eversweet",
  description:
    "How to delete your Eversweet app account and what happens to your information.",
  alternates: { canonical: "/delete-account" },
};

/**
 * Google Play requires an app that creates accounts to link a web page where anyone can ask
 * for their account to be deleted without the app installed. Deletion itself happens in the
 * app (Account details, Delete account); this page says how, and gives the email route for
 * someone who no longer has it. Staff carry out an emailed request with the order server's
 * `scripts/scheduleAccountDeletion.ts`, which schedules it exactly as the app does.
 *
 * What is deleted and what is kept is section 16 of the Privacy Policy, summarised here and
 * linked, so the detail lives in one place. English only, as the legal documents are.
 */
export default async function DeleteAccountPage() {
  const { email } = await getShopProfile();
  const mailto = `mailto:${email}?subject=${encodeURIComponent("Delete my Eversweet account")}`;

  return (
    <DocumentPage
      title="Delete your Eversweet account"
      subtitle="For accounts in the Eversweet app on Android and iPhone, made by Eversweet Limited. Ordering on this website does not use an account."
    >
      <DocumentSection heading="In the app">
        <ol className={DOC_STEPS}>
          <li>Open the app and sign in.</li>
          <li>
            Go to <strong>Profile</strong>, then{" "}
            <strong>Account details</strong>.
          </li>
          <li>
            Tap <strong>Delete account</strong> and enter your password.
          </li>
        </ol>
        <p className={DOC_TEXT}>
          Your account is deleted seven days later. We email you the date, and
          until then the account works as normal and you can cancel the deletion
          in the app.
        </p>
      </DocumentSection>

      <DocumentSection heading="Without the app">
        <p className={DOC_TEXT}>
          Email{" "}
          <a href={mailto} className={DOC_LINK}>
            {email}
          </a>{" "}
          from the email address on your account, asking us to delete it. We
          only act on a request from the account&apos;s own address. We will
          schedule the deletion in the same way and email you the date, and you
          can still cancel it in the app until then.
        </p>
      </DocumentSection>

      <DocumentSection heading="What is deleted, and what is kept">
        <ul className={DOC_LIST}>
          <li>
            Deleted: your account and its details, your Sweet Points and their
            history, your cart, your offers, your notification token, and your
            customer record with Stripe, which holds your saved cards.
          </li>
          <li>
            A membership stops renewing as soon as the deletion is requested,
            and ends when the account is deleted.
          </li>
          <li>
            Kept: the record of orders you placed, which we must keep for tax
            purposes, with your name, email address and phone number removed so
            they are no longer linked to you.
          </li>
        </ul>
        <p className={DOC_TEXT}>
          The full detail is in section 16 of our{" "}
          <Link href="/privacy-policy" className={DOC_LINK}>
            Privacy Policy
          </Link>
          .
        </p>
      </DocumentSection>
    </DocumentPage>
  );
}
