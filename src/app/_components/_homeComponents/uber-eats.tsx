"use client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { useLanguage } from "../../components/language";
export default function UberEats() {
  const { language } = useLanguage();
  return (
    <section className="flex flex-col items-center p-8 text-center">
      <Image
        src="/uber-eats.png"
        alt="Uber Eats Logo"
        width={200}
        height={100}
        className="mb-4"
      />
      <h2 className="mb-2 text-2xl font-bold text-gray-900">
        {language === "en"
          ? "We will deliver with Uber Eats soon!"
          : "我们很快将会通过 Uber Eats 提供配送服务！"}{" "}
        {/* 我们使用Uber Eats送货! */}
      </h2>

      <p className="mb-4 text-gray-600">
        {language === "en"
          ? "Enjoy your favorite desserts and drinks delivered straight to your door."
          : "享受您最喜欢的甜点和饮料直接送到您家门口。"}
      </p>
      {/* <Link
        href={"https://www.ubereats.com"}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Button className="p-6 text-xl lg:p-7 lg:text-2xl">
          {language === "en" ? "Order with" : "订购与"}{" "}
          <span className="text-black">Uber</span>{" "}
          <span className="text-green-500">Eats</span>
        </Button>
      </Link> */}
    </section>
  );
}
