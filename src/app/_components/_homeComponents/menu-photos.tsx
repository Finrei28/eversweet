"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "~/components/ui/button";
import { X } from "lucide-react";

export default function Menu() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedImage) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [selectedImage]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="mb-4 text-3xl font-bold text-gray-900">
        Take a look at our menu
      </h2>

      <div className="grid h-auto w-full grid-cols-1 gap-6 overflow-hidden rounded-lg py-5 xl:grid-cols-2">
        {["/Eversweet main menu.jpg", "/Eversweet side menu.jpg"].map((src) => (
          <div
            className="relative flex w-full items-center rounded-lg"
            key={src}
          >
            <Image
              src={src}
              alt={src}
              width={1000} // Adjust width dynamically
              height={1000} // Adjust height dynamically
              className="h-auto w-full rounded-lg object-contain transition-transform duration-300 lg:hover:scale-y-105 lg:hover:cursor-pointer lg:hover:shadow-lg"
              onClick={() => setSelectedImage(src)}
            />
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
          onClick={() => setSelectedImage(null)} // Close modal on background click
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <Image
              src={selectedImage}
              alt="Enlarged Image"
              width={1200}
              height={1200}
              className="h-auto max-h-[95vh] w-auto max-w-[95vw] rounded-lg object-cover"
            />
            <Button
              className="absolute right-1 top-1 lg:right-4 lg:top-4"
              variant={"ghost"}
              onClick={() => setSelectedImage(null)} // Close modal on button click
            >
              <X className="h-6 w-6" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
