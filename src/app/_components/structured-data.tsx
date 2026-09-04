// app/components/structured-data.tsx

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Eversweet",
  url: "https://eversweet.co.nz",
  logo: "https://res.cloudinary.com/dlqjgl6ju/image/upload/v1743833655/eversweetTransLogo_qz1kmg.png",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "09 949 1050",
    contactType: "customer service",
  },
};

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
export default function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  );
}
