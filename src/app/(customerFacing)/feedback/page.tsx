import { Metadata } from "next";
import FeedbackComponent from "./_components/feedback";

export const metadata: Metadata = {
  title: "Eversweet - Feedback",
  description:
    "We'd love to hear about your feedback on our products or service!",
};

export default function FeedbackPage() {
  return <FeedbackComponent />;
}
