import "~/styles/globals.css";

import { Figtree, Noto_Serif_SC } from "next/font/google";
import type { Metadata } from "next";
import type React from "react";

// Direction D's faces, self-hosted by next/font at build time. Figtree is English
// only, so Chinese interface text falls through to the system sans after it in
// `font-sans` (PingFang SC, Microsoft YaHei).
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

// Chinese dessert, category and customisation names (`font-zh`), and the 甜 seal.
// Google serves the face in unicode-range slices, so a page downloads only the
// slices holding the characters it shows. Not preloaded: no one slice is needed
// everywhere, and preloading them all would fetch the whole face.
const notoSerifSC = Noto_Serif_SC({
  weight: ["600", "900"],
  variable: "--font-noto-serif-sc",
  display: "swap",
  preload: false,
});

import { TRPCReactProvider } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Toaster } from "~/components/ui/toaster";
import StructuredData from "./_components/structured-data";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  // Canonical host for the site. Every relative URL in page metadata
  // (openGraph, twitter, alternates.canonical) resolves against this, which is
  // what keeps the www / non-www split from producing two sets of URLs.
  metadataBase: new URL("https://www.eversweet.co.nz"),
  title: "Eversweet",
  description:
    'Eversweet offers chinese desserts and drinks, including "boba" tea, mochi desserts, Sago desserts and more.',
  // The icons are files beside this layout (icon.png, apple-icon.png, favicon.ico), which Next.js
  // links itself: the app's square bowl on white. They were the wide, transparent header logo,
  // which Google search showed as a black circle - it fills transparency with black and squeezes
  // a wide image into its round slot.
  keywords:
    "Eversweet, sweet treats, desserts, Sago, boba, bubble tea, mochi, drinks, grass jelly,",
  openGraph: {
    type: "website",
    locale: "en_NZ",
    url: "https://www.eversweet.co.nz",
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
      className={`${figtree.variable} ${notoSerifSC.variable}`}
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
