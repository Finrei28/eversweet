/**
 * The delivery services the shop is on, as the home page's delivery band offers them. Every
 * order placed on this website or in the app is collected from the shop; delivery is ordered
 * on these platforms instead, under their own terms.
 *
 * Each link is the shop's own store page. They were copied from search results and cleaned:
 * no tracking tokens (`rwg_token`, `srsltid`, `utm_*`), and no `pickup=true`, which opened the
 * DoorDash store in pickup mode rather than delivery. The icons are each company's App Store
 * icon, in `public/`.
 */
export type DeliveryPlatform = {
  name: string;
  /** The name on the Chinese page, where the platform has its own. */
  chineseName?: string;
  href: string;
  icon: string;
};

export const DELIVERY_PLATFORMS: readonly DeliveryPlatform[] = [
  {
    name: "Uber Eats",
    href: "https://www.ubereats.com/nz/store/eversweet/cdSuxGsZSUSGotTxyjfrvQ",
    icon: "/uber-eats.png",
  },
  {
    name: "DoorDash",
    href: "https://www.doordash.com/store/eversweet-auckland-34536099/71053546/",
    icon: "/doordash.png",
  },
  {
    name: "HungryPanda",
    chineseName: "熊猫外卖",
    href: "https://nzd.hungrypanda.co/shop?shopId=136820118",
    icon: "/hungrypanda.png",
  },
];
