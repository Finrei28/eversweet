import { type ReactNode } from "react";

/**
 * A "$" drawn inside a money box, before what is typed, so the box keeps its full width and
 * lines up with the boxes beside it. The input it wraps takes `pl-7` to clear it.
 *
 * Hidden from screen readers: each box names itself with an `aria-label`, and the amount is
 * read as the number typed.
 */
export default function DollarPrefix({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
      >
        $
      </span>
      {children}
    </div>
  );
}
