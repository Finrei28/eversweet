"use client";

import {
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import { oneLineAddress, telHref, type ShopProfile } from "~/lib/shopSettings";

const MAPS_PLACE_URL =
  "https://www.google.com/maps/place/EVERSWEET/@-36.9125301,174.9266263,17z/data=!4m14!1m7!3m6!1s0x6d0d4b005804e6ff:0x6884c715c4f2b74f!2sEVERSWEET!8m2!3d-36.9125301!4d174.9292012!16s%2Fg%2F11mcysftnm!3m5!1s0x6d0d4b005804e6ff:0x6884c715c4f2b74f!8m2!3d-36.9125301!4d174.9292012!16s%2Fg%2F11mcysftnm?entry=ttu&g_ep=EgoyMDI2MDcyNi4wIKXMDSoASAFQAw%3D%3D";

/** The three bowls under the map, from the photos the site already carries. */
const BOWLS = [
  { src: process.env.NEXT_PUBLIC_GRASS_JELLY_URL, name: "Grass Jelly Bowl" },
  { src: process.env.NEXT_PUBLIC_MOCHI_URL, name: "Mochi Bowl" },
  { src: process.env.NEXT_PUBLIC_SAGO_URL, name: "Sago Bowl" },
];

/**
 * Contact, as direction D draws it: the heading with the way to the opening hours, three
 * columns divided by hairlines (one above the other on a phone), the map in a framed
 * corner, and three bowls on rice.
 */
export default function ContactComponent({
  profile,
}: {
  profile: ShopProfile;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const address = `${profile.name}, ${oneLineAddress(profile)}`;
  const googleMapsUrl = `https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${encodeURIComponent(address)}&zoom=16`;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pb-12 pt-8 lg:pb-14 lg:pt-12">
      <header className="flex flex-col gap-3 pb-6 lg:flex-row lg:items-end lg:justify-between lg:pb-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.01em] lg:text-5xl">
            {en ? "Contact us" : "联系我们"}
          </h1>
          <p className="text-base text-muted-foreground lg:text-lg">
            {en
              ? "We'd love to hear from you! Reach out for orders or inquiries."
              : "我们很乐意听取您的意见！联系我们进行订购、咨询或只是打个招呼。"}
          </p>
        </div>
        <Link
          href="/?scrollTo=opening-hours"
          className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md text-base font-bold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:self-auto"
        >
          <Clock className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden />
          {en ? "Business hours" : "营业时间"}
        </Link>
      </header>

      <div className="grid divide-y divide-border border-y border-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <ContactColumn
          icon={Phone}
          title={en ? "Call us" : "给我们打电话"}
          text={
            en
              ? "We're available to take your call during business hours."
              : "我们在营业时间内可以接听您的电话。"
          }
        >
          <a
            href={telHref(profile.phone)}
            className="mt-1 self-start text-[22px] font-extrabold tabular-nums hover:underline"
          >
            {profile.phone}
          </a>
        </ContactColumn>

        <ContactColumn
          icon={Mail}
          title={en ? "Email us" : "给我们发邮件"}
          text={
            en
              ? "Send us an email and we'll get back to you as soon as possible."
              : "给我们发送电子邮件，我们会尽快回复您。"
          }
        >
          <a
            href={`mailto:${profile.email}`}
            className="mt-1 self-start text-lg font-extrabold [overflow-wrap:anywhere] hover:underline lg:text-[19px]"
          >
            {profile.email}
          </a>
        </ContactColumn>

        <ContactColumn
          icon={MapPin}
          title={en ? "Visit us" : "来访我们"}
          text={
            en
              ? "Come by our shop and enjoy our handmade desserts."
              : "来我们的商店，享受我们手工制作的甜点。"
          }
        >
          <p className="mt-1 text-[17px] font-bold">
            {oneLineAddress(profile)}
          </p>
          <Button
            asChild
            variant="secondary"
            size="pill-sm"
            className="mt-1 self-start"
          >
            <a href={MAPS_PLACE_URL} target="_blank" rel="noopener noreferrer">
              {en ? "View on map" : "在地图上查看"}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </Button>
        </ContactColumn>
      </div>

      <section className="flex flex-col gap-5 pt-10 lg:pt-12">
        <h2 className="text-2xl font-extrabold lg:text-[28px]">
          {en ? "Our location" : "我们的位置"}
        </h2>
        <div className="h-[300px] overflow-hidden rounded-card border border-border bg-muted md:h-[380px]">
          {mapsKey ? (
            <iframe
              title={en ? "Our location" : "我们的位置"}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={googleMapsUrl}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center text-muted-foreground">
              <MapPin
                className="h-9 w-9 text-accent"
                strokeWidth={1.8}
                aria-hidden
              />
              <p className="text-[15px] font-semibold">
                {en
                  ? "Google Maps API key is required to display the map"
                  : "需要Google Maps API密钥才能显示地图"}
              </p>
            </div>
          )}
        </div>
      </section>

      <ul className="flex justify-center gap-6 pt-10 sm:gap-14 lg:pt-12">
        {BOWLS.map((bowl) => (
          <li key={bowl.name} className="flex flex-col items-center gap-2.5">
            <span className="relative h-24 w-24 overflow-hidden rounded-full bg-muted sm:h-[120px] sm:w-[120px]">
              {bowl.src && (
                <Image
                  src={bowl.src}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              )}
            </span>
            <span className="text-center text-[15px] font-bold">
              {bowl.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One of the three columns: an icon on peach, a heading, a line, then the detail. */
function ContactColumn({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5 py-7 lg:px-8 lg:py-8 lg:first:pl-0 lg:last:pr-0">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary"
        aria-hidden
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </span>
      <h2 className="mt-1.5 text-[22px] font-extrabold">{title}</h2>
      <p className="text-base leading-[1.45] text-muted-foreground">{text}</p>
      {children}
    </section>
  );
}
