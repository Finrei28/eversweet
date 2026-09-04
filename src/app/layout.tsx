import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { Baloo_2 } from "next/font/google";
import type { Metadata } from "next";
import type React from "react";

// Rounded display face for headings — the wordmark in the logo is rounded, and
// a monospace stack read as a terminal rather than a dessert shop.
const displayFont = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

import { TRPCReactProvider } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Toaster } from "~/components/ui/toaster";
import StructuredData from "./_components/structured-data";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Eversweet",
  description:
    'Eversweet offers chinese desserts and drinks, including "boba" tea, mochi desserts, Sago desserts and more.',
  icons: [
    { rel: "icon", url: `${process.env.NEXT_PUBLIC_LOGO_URL}` },
    { rel: "apple-touch-icon", url: `${process.env.NEXT_PUBLIC_LOGO_URL}` },
    { rel: "shortcut icon", url: `${process.env.NEXT_PUBLIC_LOGO_URL}` },
  ],
  keywords:
    "Eversweet, sweet treats, desserts, Sago, boba, bubble tea, mochi, drinks, grass jelly,",
  openGraph: {
    type: "website",
    locale: "en_NZ",
    url: "https://eversweet.co.nz",
    siteName: "Eversweet",
    title: "Eversweet - Chinese Desserts",
    description:
      'Eversweet offers chinese desserts and drinks, including "boba" tea, mochi desserts, Sago desserts, and more.',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_LOGO_URL}`,
        width: 1200,
        height: 630,
        alt: "Eversweet Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eversweet - Chinese Desserts",
    description:
      'Eversweet offers chinese desserts and drinks, including "boba" tea, mochi desserts, Sago desserts and more.',
    images: [`${process.env.NEXT_PUBLIC_LOGO_URL}`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${displayFont.variable}`}
    >
      <body className={cn("overflow-x-hidden bg-background font-sans")}>
        <TRPCReactProvider>
          <main>{children}</main>
          <Analytics />
          <StructuredData />
          <Toaster />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
