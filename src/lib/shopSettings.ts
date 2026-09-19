/**
 * The shop settings that used to be hardcoded in the order server: the loyalty earn rates,
 * the shop's own details, the launch announcements and the membership benefits.
 *
 * Pure - no database, no `server-only` - so the admin forms and the router validate against
 * the same numbers. The bounds below are the zod half of the rules; their other half is the
 * CHECK constraints in 20260919000000_shop_settings_from_code. Change one and change the
 * other, or an admin is refused by Postgres with an error meant for a programmer.
 *
 * Note that `prisma db push` never creates CHECK constraints, so a test database built that
 * way does not have them and the suites prove this layer rather than the database's.
 */

/** Points per dollar. Zero is legal: it switches earning off without deleting the row. */
export const POINTS_PER_DOLLAR_MIN = 0;
/**
 * Not a rule of the business, just a typo guard. 100 points a dollar is already far beyond
 * anything the shop has run, and the failure this prevents - a fat-fingered extra zero
 * awarding ten times the points on every order until someone notices - is expensive and
 * cannot be taken back from customers once given.
 */
export const POINTS_PER_DOLLAR_MAX = 100;

/**
 * A member's multiplier, in whole percent: 150 is 1.5x. Never below 100, or the people
 * paying for the membership would quietly earn less than those who are not.
 */
export const MEMBER_BONUS_PERCENT_MIN = 100;
export const MEMBER_BONUS_PERCENT_MAX = 500;

/** Applied to everyone. 200 is a double-points weekend; 0 pauses earning altogether. */
export const MODIFIER_PERCENT_MIN = 0;
export const MODIFIER_PERCENT_MAX = 500;

/** Whole percent to the multiplier the order server serves: 150 becomes 1.5. */
export const asMultiplier = (percent: number) => percent / 100;

/**
 * How a benefit or announcement should read before it is saved. Long enough for a real
 * sentence, short enough that the app's tick-list and pop-up still lay out.
 */
export const BENEFIT_MAX_LENGTH = 120;
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 60;
export const ANNOUNCEMENT_TEXT_MAX_LENGTH = 300;

/** The app renders at most this many pages in its launch pop-up before it reads as spam. */
export const MAX_ACTIVE_ANNOUNCEMENTS = 5;

/**
 * The shop's own details, as the `ShopProfile` table holds them and the order server serves
 * them from `/api/getStoreInfo`.
 *
 * Here rather than in `~/server/shopProfile` because the contact page's component is a
 * client component and that module is `server-only`; a type is erased, but `oneLineAddress`
 * is not.
 */
export type ShopProfile = {
  name: string;
  address: string;
  city: string;
  state: string;
  postal: string;
  phone: string;
  email: string;
  website: string;
};

/**
 * What was hardcoded before the table existed. Used until the row is read and whenever it
 * cannot be, so a page renders the shop's real address rather than a gap - unlike the
 * trading hours, where there is deliberately no fallback, because a guessed opening time
 * sells a customer a pick-up the shop cannot honour. A stale address cannot mislead that
 * way.
 */
export const DEFAULT_SHOP_PROFILE: ShopProfile = {
  name: "Eversweet",
  address: "5D/119 Meadowland Drive, Somerville",
  city: "Auckland",
  state: "Auckland",
  postal: "2014",
  phone: "09 949 1050",
  email: "eversweet@eversweet.co.nz",
  website: "https://eversweet.co.nz",
};

/** The address as one line, the way the contact page and the JSON-LD both want it. */
export const oneLineAddress = (profile: ShopProfile): string =>
  `${profile.address}, ${profile.city} ${profile.postal}`;
