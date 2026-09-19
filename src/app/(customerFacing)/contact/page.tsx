import { Metadata } from "next";
import ContactComponent from "./_components/contact";
import { getShopProfile } from "~/server/shopProfile";

export const metadata: Metadata = {
  title: "Eversweet - Contact",
  description:
    "Call us during our business hours or send us an email for any inquries or orders.",
  alternates: { canonical: "/contact" },
};

/**
 * The shop's details come from the `ShopProfile` table the order server also reads, so the
 * phone number here and the one on the app's store screen cannot drift. They were written
 * out separately in both repos, in two different formats.
 */
export default async function ContactPage() {
  return <ContactComponent profile={await getShopProfile()} />;
}
