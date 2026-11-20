"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * Direction D's sheet, on Radix Dialog like `dialog.tsx`, so focus is trapped and
 * returned, Escape and the scrim close it, and the page underneath stops scrolling.
 *
 * - `bottom` is a phone's: up from the bottom edge, round top corners, a handle.
 * - `right` is a desktop's panel: full height, in from the right.
 * - `center` is a desktop's dialog, for what a phone shows as a bottom sheet (the
 *   customise dialog) or what needs the whole screen (a menu board full size).
 *
 * A caller that wants both picks the side per width (see `cartSheet.tsx`); Tailwind
 * cannot switch the slide direction by breakpoint without leaving the other axis's
 * offset behind.
 */
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 flex flex-col bg-background focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
  {
    variants: {
      side: {
        bottom:
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-sheet pb-[env(safe-area-inset-bottom)] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        right:
          "inset-y-0 right-0 h-full w-full max-w-[440px] border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        // A desktop's dialog: in the middle of the screen, every corner round. The
        // caller sets the width; it never runs past the screen's edges.
        center:
          "left-1/2 top-1/2 max-h-[calc(100dvh-48px)] w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-sheet data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
      },
    },
    defaultVariants: { side: "bottom" },
  },
);

export interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

/**
 * Closing a sheet hands focus back to whatever opened it. Radix returns focus only to a
 * `SheetTrigger`, and most sheets here are opened by buttons that are not one: the header's
 * menu and cart buttons, the cart bar, a menu board. Closing one left focus on the page
 * itself, so a keyboard user started again from the top. The opener is read as the sheet
 * opens, before focus moves into it, and skipped if it has left the page since (the cart bar
 * goes when the cart is emptied).
 */
const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side = "bottom",
      className,
      children,
      onOpenAutoFocus,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    const opener = React.useRef<HTMLElement | null>(null);

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          ref={ref}
          className={cn(sheetVariants({ side }), className)}
          onOpenAutoFocus={(event) => {
            opener.current =
              document.activeElement instanceof HTMLElement &&
              document.activeElement !== document.body
                ? document.activeElement
                : null;
            onOpenAutoFocus?.(event);
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            const element = opener.current;
            opener.current = null;
            if (event.defaultPrevented || !element?.isConnected) return;
            event.preventDefault();
            element.focus();
          }}
          {...props}
        >
          {side === "bottom" && (
            <div aria-hidden className="flex shrink-0 justify-center pt-2.5">
              <span className="h-[5px] w-10 rounded-full bg-border" />
            </div>
          )}
          {children}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 items-center justify-between gap-3 px-5 pb-1 pt-1.5",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-[26px] font-extrabold leading-tight", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-[15px] text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

/** The sheet's ✕: peach and 44px, named in the reader's language by the caller. */
const SheetCloseButton = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Close>,
  Omit<
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Close>,
    "children"
  > & {
    label: string;
  }
>(({ label, className, ...props }, ref) => (
  <SheetPrimitive.Close
    ref={ref}
    aria-label={label}
    className={cn(
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      className,
    )}
    {...props}
  >
    <X className="h-5 w-5" aria-hidden />
  </SheetPrimitive.Close>
));
SheetCloseButton.displayName = "SheetCloseButton";

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetCloseButton,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
