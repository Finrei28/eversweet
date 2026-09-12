"use client";

import { format } from "date-fns";
import { enNZ, zhCN } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";

import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

type DateFieldProps = {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder: string;
  /** Days the calendar should refuse, e.g. everything before today. */
  disabled?: (date: Date) => boolean;
};

/**
 * A nullable date picker, composed the way pick-up-time.tsx does it - there is no
 * date-picker primitive in this project, only Popover + Calendar + Button.
 *
 * Clearing matters as much as picking. Every date this drives is optional: an offer
 * with no start bound runs as soon as it is switched on, and one with no end bound runs
 * until it is switched off. Without a way back to null an admin could schedule an offer
 * and then never un-schedule it.
 */
export default function DateField({
  value,
  onChange,
  placeholder,
  disabled,
}: DateFieldProps) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const locale = language === "en" ? enNZ : zhCN;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(value, "d MMM yyyy", { locale }) : placeholder}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            onChange(date ?? null);
            setIsOpen(false);
          }}
          disabled={disabled}
          locale={locale}
          initialFocus
        />

        {value && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              {language === "en" ? "Clear" : "清除"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
