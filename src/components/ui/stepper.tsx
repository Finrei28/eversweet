"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * Direction D's stepper: a red-bean outlined minus, the count, an apricot plus. Each
 * button is a 44px target around a smaller circle, and is named by the caller in the
 * reader's language ("One more Taro Bowl"). A disabled minus fades its outline to the
 * hairline colour, as the mock-ups draw it.
 */
export function Stepper({
  value,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
  decreaseDisabled = false,
  increaseDisabled = false,
  size = "md",
  className,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
  decreaseDisabled?: boolean;
  increaseDisabled?: boolean;
  /** `sm` 30px circles, `md` 32px, `lg` 36px; the target is 44px either way. */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const circle =
    size === "sm" ? "h-[30px] w-[30px]" : size === "lg" ? "h-9 w-9" : "h-8 w-8";
  const button =
    "group flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default";

  return (
    <div className={cn("flex items-center", className)}>
      <button
        type="button"
        aria-label={decreaseLabel}
        onClick={onDecrease}
        disabled={decreaseDisabled}
        className={button}
      >
        <span
          className={cn(
            circle,
            "flex items-center justify-center rounded-full border-[1.5px] border-accent text-accent transition-colors group-hover:bg-muted group-disabled:border-border group-disabled:text-border group-disabled:group-hover:bg-transparent",
          )}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
        </span>
      </button>
      <span
        className={cn(
          "text-center font-bold tabular-nums",
          size === "lg" ? "w-[22px] text-[17px] font-extrabold" : "w-4",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        onClick={onIncrease}
        disabled={increaseDisabled}
        className={cn(button, "disabled:opacity-40")}
      >
        <span
          className={cn(
            circle,
            "flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-[filter] group-hover:brightness-95 group-disabled:group-hover:brightness-100",
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
        </span>
      </button>
    </div>
  );
}
