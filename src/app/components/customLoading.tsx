"use client";

import { Loader2 } from "lucide-react";

import { useLanguage } from "~/app/components/language";

type LoaderProps = {
  // Both languages rather than a string: the admin pages that render this are server
  // components and cannot call useLanguage() to choose one themselves.
  text?: { en: string; zh: string };
};

export default function Loader({ text }: LoaderProps) {
  const { language } = useLanguage();

  return (
    <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        {text && (
          <p className="text-lg font-medium text-primary">
            {language === "en" ? text.en : text.zh}
          </p>
        )}
      </div>
    </div>
  );
}
