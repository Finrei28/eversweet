import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Eversweet",
  description:
    "Learn how Eversweet collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <MaxWidthWapper>
      <div className="py-12 md:py-16">
        <h1 className="mb-8 text-center text-3xl font-bold md:text-4xl">
          Privacy Policy
        </h1>

        <div className="prose prose-lg mx-auto max-w-3xl">
          <p className="text-muted-foreground">
            Last Updated:{" "}
            {new Date().toLocaleDateString("en-NZ", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              1. Introduction
            </h2>
            <p>
              Welcome to Eversweet ("we," "our," or "us"). We respect your
              privacy and are committed to protecting your personal data. This
              privacy policy explains how we collect, use, disclose, and
              safeguard your information when you visit our website
              (eversweet.co.nz), use our services, or place an order with us.
            </p>
            <p>
              Please read this privacy policy carefully. If you do not agree
              with the terms of this privacy policy, please do not access our
              website or use our services.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              2. Information We Collect
            </h2>
            <p>We may collect the following types of information:</p>
            <h3 className="text-lg font-medium">Personal Information</h3>
            <ul>
              <li>Name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Billing and delivery address</li>
              <li>
                Payment information (processed securely through our payment
                processors)
              </li>
            </ul>

            <h3 className="text-lg font-medium">Order Information</h3>
            <ul>
              <li>Products purchased</li>
              <li>Order history</li>
              <li>Special instructions or preferences</li>
              <li>Dietary requirements or allergies you choose to share</li>
            </ul>

            <h3 className="text-lg font-medium">
              Automatically Collected Information
            </h3>
            <ul>
              <li>IP address</li>
              <li>Browser type</li>
              <li>Device information</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Usage data (how you interact with our website)</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              3. How We Use Your Information
            </h2>
            <p>We use your information for the following purposes:</p>
            <ul>
              <li>Process and fulfill your orders</li>
              <li>Communicate with you about your orders</li>
              <li>Provide customer support</li>
              <li>
                Send you promotional offers and newsletters (if you opt in)
              </li>
              <li>Improve our website and services</li>
              <li>Comply with legal obligations</li>
              <li>Detect and prevent fraud</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              4. Cookies and Tracking Technologies
            </h2>
            <p>
              We use cookies and similar tracking technologies to track activity
              on our website and store certain information. Cookies are files
              with a small amount of data that may include an anonymous unique
              identifier.
            </p>
            <p>
              You can instruct your browser to refuse all cookies or to indicate
              when a cookie is being sent. However, if you do not accept
              cookies, you may not be able to use some portions of our website.
            </p>
            <p>We use cookies for the following purposes:</p>
            <ul>
              <li>To remember your preferences and settings</li>
              <li>To keep you logged in (where applicable)</li>
              <li>To understand how you use our website</li>
              <li>To personalize your experience</li>
              <li>To help us improve our website and services</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              5. Third-Party Services
            </h2>
            <p>
              We may use third-party service providers to help us operate our
              business and the website or administer activities on our behalf,
              such as sending out newsletters or surveys. We may share your
              information with these third parties for those limited purposes.
            </p>
            <p>These third-party service providers include:</p>
            <ul>
              <li>Payment processors (e.g., Stripe)</li>
              <li>Analytics providers (e.g., Google Analytics)</li>
              <li>Email service providers</li>
              <li>Hosting and cloud infrastructure providers</li>
            </ul>
            <p>
              Each of these providers has their own privacy policies governing
              how they use your information.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              6. Data Security
            </h2>
            <p>
              We implement appropriate security measures to protect your
              personal information. However, please be aware that no method of
              transmission over the internet or electronic storage is 100%
              secure, and we cannot guarantee the absolute security of your
              data.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              7. Your Rights
            </h2>
            <p>
              Depending on your location, you may have the following rights
              regarding your personal information:
            </p>
            <ul>
              <li>Access to your personal information</li>
              <li>Correction of inaccurate or incomplete information</li>
              <li>Deletion of your personal information</li>
              <li>Restriction of processing of your personal information</li>
              <li>Data portability</li>
              <li>Objection to processing of your personal information</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us using the
              information provided in the "Contact Us" section below.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              8. Children's Privacy
            </h2>
            <p>
              Our website is not intended for children under 16 years of age. We
              do not knowingly collect personal information from children under
              16. If you are a parent or guardian and believe your child has
              provided us with personal information, please contact us.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              9. Changes to This Privacy Policy
            </h2>
            <p>
              We may update our privacy policy from time to time. We will notify
              you of any changes by posting the new privacy policy on this page
              and updating the "Last Updated" date at the top of this policy.
              You are advised to review this privacy policy periodically for any
              changes.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold md:text-2xl">
              10. Contact Us
            </h2>
            <p>
              If you have any questions about this privacy policy or our data
              practices, please contact us at:
            </p>
            <div className="mt-4">
              <p>
                <strong>Eversweet</strong>
              </p>
              <p>5D/119 Meadowland Drive, Somerville, Auckland 2014</p>
              <p>Email: eversweet@eversweet.co.nz</p>
              <p>Phone: 09 949 1050</p>
            </div>
          </section>
        </div>
      </div>
    </MaxWidthWapper>
  );
}
