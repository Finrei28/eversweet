// app/components/structured-data.tsx

import { getShopProfile } from "~/server/shopProfile";

const LOGO_URL =
  "https://res.cloudinary.com/dlqjgl6ju/image/upload/v1743833655/eversweetTransLogo_qz1kmg.png";

/**
 * Rendered as a plain <script> rather than next/script.
 *
 * next/script defaults to the `afterInteractive` strategy, which injects the
 * tag on the client after hydration. The server HTML therefore did not contain
 * it while the hydrated DOM did, and that mismatch made React discard the
 * server-rendered markup and re-render the whole tree on the client - on every
 * page. JSON-LD is inert data, so it can simply be part of the HTML, which is
 * also where crawlers expect to find it.
 */
export default async function StructuredData() {
  // The shop's details come from the table the order server also reads, so the number a
  // crawler publishes and the one the app shows cannot drift.
  const profile = await getShopProfile();

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: profile.name,
    url: profile.website,
    logo: LOGO_URL,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: profile.phone,
      contactType: "customer service",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  );
}
