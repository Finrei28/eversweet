import { Metadata } from "next";
import ContactComponent from "./_components/contact";

export const metadata: Metadata = {
  title: "Eversweet - Contact",
  description:
    "Call us during our business hours or send us an email for any inquries or orders.",
};

export default function ContactPage() {
  return <ContactComponent />;
}
