"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useLanguage } from "~/app/components/language";
import StoreBadges from "~/app/components/storeBadges";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  anotherDialogOpen,
  APP_OFFER_DELAY_MS,
  APP_OFFER_TICK_MS,
  appOfferAllowedOn,
  appOfferCopy,
  hasSeenAppOffer,
  quietAfterTick,
  rememberAppOfferSeen,
  sessionStore,
} from "~/lib/appOffer";
import { api } from "~/trpc/react";

/**
 * The pop-up that sends website visitors to the customer app for its sago offer, on every
 * customer page but checkout, an order and Delete account (`~/lib/appOffer` has the rules).
 *
 * It is the app's offer, read live by `~/server/appOffer`, and nothing on this website
 * applies it, so it says so in as many words. It shows nothing at all unless the offer is
 * running.
 *
 * - **Rendered closed on the server and through hydration.** Session storage and the offer
 *   are read only after mount, and it opens from a timer, so the home page's hero still
 *   paints in the first frame and no hydration sees a dialog the server did not render.
 * - **Once per browser session**, remembered the moment it opens.
 * - **Three quiet seconds first.** The countdown starts again whenever another dialog is
 *   open - the cart, the customise sheet, the closure notice, the phone's menu - or the tab
 *   is in the background, so it never stacks on another dialog or opens unseen.
 */
export function AppOfferPopup() {
  const pathname = usePathname();
  const allowed = appOfferAllowedOn(pathname);
  const { language } = useLanguage();

  const [unseen, setUnseen] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUnseen(!hasSeenAppOffer(sessionStore(window)));
  }, []);

  // Asked only by a visitor who has not seen it this session, on a page it may open on.
  const { data: offer } = api.store.getAppOffer.useQuery(undefined, {
    enabled: unseen && allowed,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!offer || !unseen || !allowed) return;

    // Restarts on every page: three quiet seconds on the page it opens over.
    let quietMs = 0;
    const timer = setInterval(() => {
      quietMs = quietAfterTick(
        quietMs,
        APP_OFFER_TICK_MS,
        document.visibilityState === "hidden" || anotherDialogOpen(document),
      );
      if (quietMs < APP_OFFER_DELAY_MS) return;

      clearInterval(timer);
      rememberAppOfferSeen(sessionStore(window), offer.id);
      setUnseen(false);
      setOpen(true);
    }, APP_OFFER_TICK_MS);
    return () => clearInterval(timer);
  }, [offer, unseen, allowed, pathname]);

  // The browser's Back button can reach checkout with it up.
  useEffect(() => {
    if (!allowed) setOpen(false);
  }, [allowed]);

  if (!offer) return null;

  const copy = appOfferCopy(offer, language);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        closeLabel={copy.close}
        className="max-h-[calc(100dvh-40px)] w-[calc(100%-40px)] max-w-md gap-0 overflow-y-auto rounded-card border-border bg-card p-6 sm:p-8"
      >
        {offer.imageUrl && (
          <span
            aria-hidden
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted sm:h-[104px] sm:w-[104px]"
          >
            <Image
              src={offer.imageUrl}
              alt=""
              fill
              sizes="104px"
              className="object-cover"
            />
          </span>
        )}
        <Badge
          variant="soft"
          className={offer.imageUrl ? "mt-5 w-fit" : "w-fit"}
        >
          {copy.eyebrow}
        </Badge>
        <DialogTitle className="mt-3 break-keep text-[26px] font-extrabold leading-tight tracking-normal">
          {copy.title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-base text-foreground">
          {copy.terms}
        </DialogDescription>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {copy.notOnWebsite}
        </p>
        {/* A badge opens the store in a new tab; the offer has done its job, so it closes
            here, and the visitor comes back to the page they were on. */}
        <div className="mt-6" onClick={() => setOpen(false)}>
          <StoreBadges size="md" />
        </div>
        <DialogClose asChild>
          <Button variant="ghost" size="pill-sm" className="mt-4 w-full">
            {copy.dismiss}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
