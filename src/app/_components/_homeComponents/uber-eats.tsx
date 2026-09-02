"use client";
import Image from "next/image";
import { useLanguage } from "../../components/language";
import Link from "next/link";
import { Button } from "~/components/ui/button";
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
          ? "We deliver with Uber Eats!"
          : "我们通过 Uber Eats 提供配送服务！"}{" "}
        {/* 我们使用Uber Eats送货! */}
      </h2>

      <p className="mb-4 text-gray-600">
        {language === "en"
          ? "Enjoy your favorite desserts and drinks delivered straight to your door."
          : "享受您最喜欢的甜点和饮料直接送到您家门口。"}
      </p>
      <Link
        href={
          "https://www.ubereats.com/nz/store/eversweet/cdSuxGsZSUSGotTxyjfrvQ?srsltid=AfmBOorEzbiEiYzBZc5uP31Zun7vFrenM-uG87mVrpyvIEMeTRDPFhWS"
        }
        rel="noopener noreferrer"
        target="_blank"
      >
        {/*
          Was white + black + green-500 on the pale secondary, which measured
          1.39:1 and 1.64:1. On the deep caramel the label clears AA and the
          lighter green still reads as the Uber Eats mark.
        */}
        <Button className="bg-primary p-6 text-xl font-bold text-white shadow-lg hover:bg-primary/90 lg:p-7 lg:text-2xl">
          {language === "en" ? "Order with" : "订购与"}{" "}
          <span>Uber</span> <span className="text-green-300">Eats</span>
        </Button>
      </Link>
    </section>
  );
}
