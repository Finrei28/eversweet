import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { TopDesserts } from "../_components/top-desserts";
import Link from "next/link";
import { Button } from "~/components/ui/button";

export default async function Home() {
  void api.dessert.getMostPopularProducts.prefetch();

  return (
    <HydrateClient>
      <div className="flex min-h-screen flex-col">
        <main className="-mt-[10%] flex flex-grow flex-col items-center justify-center text-white">
          <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
            <h1 className="text-2xl font-extrabold text-primary sm:text-4xl">
              OUR MOST POPULAR DESSERTS
            </h1>
            <TopDesserts />
          </div>
          <Link href={"/menu"}>
            <Button className="p-7 text-2xl">ORDER ONLINE</Button>
          </Link>
        </main>
        <footer className="w-full bg-primary py-6 text-white">
          <div className="container mx-auto flex flex-col items-center gap-4 text-center">
            <p className="text-sm">
              © {new Date().getFullYear()} Eversweet. All rights reserved.
            </p>
            <nav className="flex gap-4">
              <Link href="/about-us" className="hover:underline">
                About Us
              </Link>
              <Link href="/contact" className="hover:underline">
                Contact
              </Link>
              <Link href="/feedback" className="hover:underline">
                Feedback
              </Link>
              <Link href="/privacy" className="hover:underline">
                Privacy Policy
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </HydrateClient>
  );
}
