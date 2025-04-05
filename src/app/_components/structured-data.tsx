// app/components/structured-data.tsx
import Script from "next/script";

export default function StructuredData() {
  return (
    <Script
      id="structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Eversweet",
          url: "https://eversweet.co.nz",
          logo: "https://res.cloudinary.com/dlqjgl6ju/image/upload/v1743833655/eversweetTransLogo_qz1kmg.png",
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+1-123-456-7890",
            contactType: "customer service",
          },
        }),
      }}
    />
  );
}
