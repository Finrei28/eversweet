import type { ReactNode } from "react";

/**
 * The layout the legal documents and the delete-account page share: one column narrow
 * enough to read, the heading and the line under it, then sections divided by hairlines.
 * Server-rendered and English only, as those pages are.
 */
export function DocumentPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-12 pt-8 lg:pb-16 lg:pt-12">
      <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.01em] lg:text-[40px]">
        {title}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

/** One section: its heading, with a chip beside it when it applies to one platform. */
export function DocumentSection({
  heading,
  label,
  children,
}: {
  heading: string;
  label?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-border pt-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-xl font-extrabold lg:text-[22px]">{heading}</h2>
        {label && (
          <span className="rounded-full bg-secondary px-3 py-1 text-[13px] font-bold text-secondary-foreground">
            {label}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** A paragraph in a section. */
export const DOC_TEXT = "mt-3 text-base leading-7";
/** A bulleted list in a section, its bullets in red bean. */
export const DOC_LIST =
  "mt-3 list-disc space-y-2 pl-5 text-base leading-7 marker:text-accent";
/** Numbered steps in a section. */
export const DOC_STEPS =
  "mt-3 list-decimal space-y-2 pl-5 text-base leading-7 marker:font-bold";
/** A link in running text: red bean, which reads on cream; apricot did not (2.0:1). */
export const DOC_LINK =
  "font-semibold text-accent underline underline-offset-2 hover:no-underline";
