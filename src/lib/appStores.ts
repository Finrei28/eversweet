/**
 * Where the Eversweet customer app is listed, and the stores' own badges that link there.
 *
 * The App Store id is the app's App Store Connect id (`ascAppId` in the app repo's
 * `frontend/eas.json`); the Play id is its Android package, `nz.co.eversweet`. The App Store
 * listing is iPhone only (`supportsTablet: false`), which is why the copy says iPhone.
 *
 * The badges are the stores' official artwork, served from `public/badges`:
 * - Apple's are its black "Download on the App Store" SVGs, English and Simplified Chinese,
 *   from Apple's marketing tools (`toolbox.marketingtools.apple.com/api/v2/badges/...`).
 *   Black, because Apple asks for the black badge whenever another store's badge is beside
 *   it, and first in the row for the same reason.
 * - Google's are its "Get it on Google Play" PNGs, English and Simplified Chinese, from
 *   `play.google.com/intl/en_us/badges/static/images/badges/`, with the transparent margin
 *   those files ship with cropped off and nothing else touched. Apple's SVG has no margin,
 *   so without the crop the two could not be shown at the same height - which Google asks for
 *   ("the same size or larger than the other badges") and Apple asks for from its side.
 *
 * Both stores ask for the localized badge on a page in another language, so the Chinese site
 * gets the Chinese ones. Neither may be recoloured, stretched or redrawn; the pixel sizes
 * below are each file's own, so the page reserves the artwork's true shape.
 */
export const APP_STORE_URL =
  "https://apps.apple.com/nz/app/eversweet/id6747155337";

export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=nz.co.eversweet";

export type StoreBadge = {
  store: "app-store" | "google-play";
  href: string;
  src: string;
  width: number;
  height: number;
  /** The badge's own words, which are what a screen reader should announce for the link. */
  alt: string;
};

export const storeBadges = (language: "en" | "zh"): StoreBadge[] =>
  language === "en"
    ? [
        {
          store: "app-store",
          href: APP_STORE_URL,
          src: "/badges/app-store-en.svg",
          width: 119.66407,
          height: 40,
          alt: "Download on the App Store",
        },
        {
          store: "google-play",
          href: GOOGLE_PLAY_URL,
          src: "/badges/google-play-en.png",
          width: 564,
          height: 168,
          alt: "Get it on Google Play",
        },
      ]
    : [
        {
          store: "app-store",
          href: APP_STORE_URL,
          src: "/badges/app-store-zh.svg",
          width: 108.85157,
          height: 40,
          alt: "在 App Store 下载",
        },
        {
          store: "google-play",
          href: GOOGLE_PLAY_URL,
          src: "/badges/google-play-zh.png",
          width: 646,
          height: 192,
          alt: "去 Google Play 下载",
        },
      ];
