import * as React from "react";

import { cn } from "~/lib/utils";

/** `field` matches `Input`'s: white, edged in `input`, ink when focused, a 14px radius. */
const VARIANTS = {
  default: "rounded-md bg-transparent px-3 py-2 shadow-sm md:text-sm",
  field:
    "rounded-[14px] bg-card px-4 py-3.5 font-medium focus-visible:border-foreground",
} as const;

export type TextareaProps = React.ComponentProps<"textarea"> & {
  variant?: keyof typeof VARIANTS;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full border border-input text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          VARIANTS[variant],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
