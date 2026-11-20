import * as React from "react";

import { cn } from "~/lib/utils";

/**
 * `field` is direction D's text field: white, edged in `input` (3.38:1 on cream) and in
 * ink once focused, 52px tall with a 14px radius, as the redesigned forms draw it. The
 * default keeps its old shape for admin, which takes the new colours and nothing else.
 */
const VARIANTS = {
  default: "h-9 rounded-md bg-transparent px-3 py-1 shadow-sm md:text-sm",
  field:
    "h-[52px] rounded-[14px] bg-card px-4 font-medium focus-visible:border-foreground",
} as const;

export type InputProps = React.ComponentProps<"input"> & {
  variant?: keyof typeof VARIANTS;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full border border-input text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          VARIANTS[variant],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
