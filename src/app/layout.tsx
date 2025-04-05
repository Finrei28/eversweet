import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Toaster } from "~/components/ui/toaster";
import StructuredData from "./_components/structured-data";

export const metadata: Metadata = {
  title: "Eversweet",
  description:
    'Eversweet offers chinese desserts and drinks, including "boba" tea, mochi desserts, Sago desserts and more.',
  icons: [{ rel: "icon", url: `${process.env.NEXT_PUBLIC_LOGO_URL}` }],
  keywords:
    "Eversweet, sweet treats, desserts, Sago, boba, bubble tea, mochi, drinks, grass jelly,",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body className={cn("overflow-x-hidden bg-background font-mono")}>
        <TRPCReactProvider>
          <main>{children}</main>
          <StructuredData />
          <Toaster />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
