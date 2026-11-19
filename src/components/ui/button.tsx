import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Ink on apricot, 7.65:1; the label was white, 2.03:1. Hover darkens the
        // apricot a little rather than swapping in a paler surface.
        default:
          "bg-primary text-primary-foreground shadow hover:brightness-95 rounded-xl",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        // Error red on its own pale ground (5.39:1), for removing rather than
        // confirming something irreversible.
        "destructive-soft":
          "bg-destructive-soft text-destructive hover:brightness-95",
        outline:
          "border border-input bg-background shadow-sm hover:bg-muted hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:brightness-95",
        // The dark surface: a selected chip, the cart bar.
        inverse: "bg-inverse text-inverse-foreground hover:bg-inverse/90",
        ghost: "hover:bg-muted hover:text-foreground",
        // Red bean, as every link in direction D. It was apricot, 1.92:1 on cream.
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        checkoutIcon: "p-3", // New variant for checkout icon button
        // Direction D's sizes, which the redesigned customer pages opt into. The
        // ones above keep their shape for admin, which takes the new colours and
        // fonts and nothing else (REDESIGN.md, decision 4).
        cta: "h-14 rounded-full px-7 text-[17px] font-extrabold shadow-none [&_svg]:size-5",
        pill: "h-[52px] rounded-full px-6 text-base font-bold shadow-none [&_svg]:size-5",
        "pill-sm":
          "h-12 rounded-full px-[22px] text-[15px] font-bold shadow-none",
        chip: "h-11 rounded-full px-[18px] text-[15px] font-semibold shadow-none",
        // Icon only, 44px: the smallest target the redesign allows.
        round: "h-11 w-11 rounded-full shadow-none [&_svg]:size-[22px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
