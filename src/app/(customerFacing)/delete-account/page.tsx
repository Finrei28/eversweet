import type { Metadata } from "next";
import Link from "next/link";

import MaxWidthWapper from "~/app/components/maxWidthWrapper";
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
    <MaxWidthWapper>
      <div className="mx-auto max-w-3xl py-12 md:py-16">
        <h1 className="mb-4 text-center text-3xl font-bold md:text-4xl">
          Delete your Eversweet account
        </h1>
        <p className="text-center text-muted-foreground">
          For accounts in the Eversweet app on Android and iPhone, made by
          Eversweet Limited. Ordering on this website does not use an account.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold md:text-2xl">In the app</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Open the app and sign in.</li>
            <li>
              Go to <strong>Profile</strong>, then{" "}
              <strong>Account details</strong>.
            </li>
            <li>
              Tap <strong>Delete account</strong> and enter your password.
            </li>
          </ol>
          <p className="mt-3 text-muted-foreground">
            Your account is deleted seven days later. We email you the date, and
            until then the account works as normal and you can cancel the
            deletion in the app.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold md:text-2xl">Without the app</h2>
          <p className="mt-3 text-muted-foreground">
            Email{" "}
            <a href={mailto} className="text-primary underline">
              {email}
            </a>{" "}
            from the email address on your account, asking us to delete it. We
            only act on a request from the account&apos;s own address. We will
            schedule the deletion in the same way and email you the date, and
            you can still cancel it in the app until then.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold md:text-2xl">
            What is deleted, and what is kept
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
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
              purposes, with your name, email address and phone number removed
              so they are no longer linked to you.
            </li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            The full detail is in section 16 of our{" "}
            <Link href="/privacy-policy" className="text-primary underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </MaxWidthWapper>
  );
}
