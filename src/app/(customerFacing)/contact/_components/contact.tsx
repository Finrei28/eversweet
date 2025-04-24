"use client";
import { useLanguage } from "~/app/components/language";
import MaxWidthWapper from "~/app/components/maxWidthWrapper";
import Image from "next/image";
import { Phone, Mail, MapPin, ExternalLink } from "lucide-react";
import { Button } from "~/components/ui/button";
import { motion } from "framer-motion";
import { useMemo } from "react";
import Link from "next/link";

export default function ContactComponent() {
  const { language } = useLanguage();
  const storeLocation = useMemo(() => {
    return {
      address: "5D/119 Meadowland Drive, Somerville, Auckland 2014",
      lat: -36.8894, // Replace with actual latitude
      lng: 174.9112, // Replace with actual longitude
    };
  }, []);

  // Google Maps URL
  const googleMapsUrl = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(storeLocation.address)}&zoom=16`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-white">
      {/* Hero section with background image */}
      <div className="relative h-64 w-full overflow-hidden bg-background sm:h-80">
        {/* <div className="absolute inset-0 z-0 opacity-20">
          <Image
            src="/placeholder.svg?height=800&width=1600"
            alt="Chinese desserts pattern"
            fill
            className="object-cover"
          />
        </div> */}
        <div className="absolute inset-0 bg-gradient-to-r from-secondary to-primary" />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
          <motion.h1
            className="font-serif text-4xl font-bold text-black sm:text-5xl md:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {language === "en" ? "Contact Us" : "联系我们"}
          </motion.h1>
          <motion.p
            className="mt-4 max-w-md text-lg text-gray-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {language === "en"
              ? "We'd love to hear from you! Reach out for orders or inquiries"
              : "我们很乐意听取您的意见！联系我们进行订购、咨询或只是打个招呼。"}
          </motion.p>
          <Link
            href={"/?scrollTo=opening-hours"}
            className="text-blue-500 underline hover:text-gray-700"
          >
            <motion.p
              className="mt-4 max-w-md text-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {language === "en" ? "Business Hours" : "营业时间"}
            </motion.p>
          </Link>
        </div>
      </div>

      <MaxWidthWapper>
        <div className="py-16">
          {/* Decorative elements */}

          {/* Contact cards */}
          <div className="grid gap-8 md:grid-cols-3">
            {/* Phone */}
            <motion.div
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
              whileHover={{ y: -5 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-pink-200 opacity-50 transition-transform group-hover:scale-110" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100">
                  <Phone className="h-6 w-6 text-pink-600" />
                </div>
                <h2 className="mb-3 text-xl font-bold text-gray-800">
                  {language === "en" ? "Call Us" : "给我们打电话"}
                </h2>
                <p className="mb-4 text-gray-600">
                  {language === "en"
                    ? "We're available to take your call during business hours."
                    : "我们在营业时间内可以接听您的电话。"}
                </p>
                <p className="font-mono text-lg font-semibold text-primary">
                  09 949 1050
                </p>
              </div>
            </motion.div>

            {/* Email */}
            <motion.div
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
              whileHover={{ y: -5 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-green-200 opacity-50 transition-transform group-hover:scale-110" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Mail className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="mb-3 text-xl font-bold text-gray-800">
                  {language === "en" ? "Email Us" : "给我们发邮件"}
                </h2>
                <p className="mb-4 text-gray-600">
                  {language === "en"
                    ? "Send us an email and we'll get back to you within 24 hours."
                    : "给我们发送电子邮件，我们将在24小时内回复您。"}
                </p>
                <p className="font-mono text-lg font-semibold text-primary">
                  eversweet@eversweet.co.nz
                </p>
              </div>
            </motion.div>

            {/* Location */}
            <motion.div
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-md transition-all hover:shadow-lg"
              whileHover={{ y: -5 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-secondary opacity-50 transition-transform group-hover:scale-110" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <h2 className="mb-3 text-xl font-bold text-gray-800">
                  {language === "en" ? "Visit Us" : "来访我们"}
                </h2>
                <p className="mb-4 text-gray-600">
                  {language === "en"
                    ? "Come by our shop and enjoy our handmade desserts. "
                    : "来我们的商店，享受我们手工制作的甜点。"}
                </p>
                <p className="mb-3 font-medium text-gray-700">
                  5D/119 Meadowland Drive, Somerville, Auckland 2014
                </p>
                <Link
                  href={
                    "https://www.google.com/maps/place/5D%2F119+Meadowland+Drive,+Somerville,+Auckland+2014"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {language === "en" ? "View on Map" : "在地图上查看"}
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Map or additional content */}
          <div className="mt-16 overflow-hidden rounded-2xl bg-white p-6 shadow-md">
            <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">
              {language === "en" ? "Our Location" : "我们的位置"}
            </h2>
            <div className="relative h-[50vh] w-full overflow-hidden rounded-xl lg:h-[70vh]">
              {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                <iframe
                  title="Store Location"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={googleMapsUrl}
                ></iframe>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-200">
                  <p className="rounded-lg bg-white/80 p-3 text-center text-gray-700">
                    {language === "en"
                      ? "Google Maps API key is required to display the map"
                      : "需要Google Maps API密钥才能显示地图"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dessert-themed footer */}
          <div className="mt-16 flex flex-wrap justify-center gap-4">
            {/* <div className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-full bg-red-100 p-4">
                <Image
                  src="/placeholder.svg?height=60&width=60"
                  alt="Boba tea"
                  width={60}
                  height={60}
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">Boba Tea</p>
            </div> */}
            <div className="flex flex-col items-center">
              <div className="relative h-28 w-28 rounded-full bg-green-100 p-4">
                <Image
                  src={process.env.NEXT_PUBLIC_GRASS_JELLY_URL as string}
                  alt="Grass Jelly"
                  fill
                  className="h-full w-full rounded-full"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">
                Grass Jelly Bowl
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="relative h-28 w-28 rounded-full bg-yellow-100 p-4">
                <Image
                  src={process.env.NEXT_PUBLIC_MOCHI_URL as string}
                  alt="Mochi"
                  fill
                  className="h-full w-full"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">
                Mochi Bowl
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="relative h-28 w-28 rounded-full bg-purple-100 p-4">
                <Image
                  src={process.env.NEXT_PUBLIC_SAGO_URL as string}
                  alt="Sago"
                  fill
                  className="h-full w-full"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">
                Sago Bowl
              </p>
            </div>
            {/* <div className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-full bg-pink-100 p-4">
                <Image
                  src="/placeholder.svg?height=60&width=60"
                  alt="Taro"
                  width={60}
                  height={60}
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">Taro</p>
            </div> */}
          </div>
        </div>
      </MaxWidthWapper>
    </div>
  );
}
