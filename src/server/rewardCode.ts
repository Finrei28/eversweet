import "server-only";

import { randomBytes } from "node:crypto";

/**
 * The code a monthly winner reads off their phone and a staff member types into the
 * till.
 *
 * 30 characters, 8 of them: 30^8 = 656,100,000,000, which is the entropy the
 * WinnerReward.code doc comment promises. Change one and change the other.
 *
 * Excludes 0, 1, I, L, O and U. This code gets read aloud across a counter and copied
 * by hand, and O/0, I/1/l and U/V are the pairs that actually get mistyped. Uppercase
 * only, so case is never part of the puzzle.
 */
export const REWARD_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export const REWARD_CODE_LENGTH = 8;

/**
 * 256 is not a multiple of 30, so `byte % 30` would hand out the first 16 characters
 * one-eighth more often than the last 14 - a real, measurable bias that shrinks the
 * effective keyspace. Bytes at or above 240, the largest multiple of 30 that fits in a
 * byte, are discarded and redrawn instead.
 */
const REJECT_AT = 240;

/**
 * `crypto.randomInt(0, 30)` would also be unbiased, but it is eight calls per code and
 * cannot be mocked in a way that proves the rejection actually happens. For a value
 * that gates a prize, the explicit version is worth the extra lines.
 */
export const generateRewardCode = (): string => {
  let code = "";

  while (code.length < REWARD_CODE_LENGTH) {
    // Over-draw: at a ~6% rejection rate one batch almost always finishes the job, so
    // this is one syscall rather than eight. The loop covers the unlucky batch.
    const bytes = randomBytes(REWARD_CODE_LENGTH * 2);

    for (const byte of bytes) {
      if (byte >= REJECT_AT) continue;

      code += REWARD_CODE_ALPHABET[byte % REWARD_CODE_ALPHABET.length];

      if (code.length === REWARD_CODE_LENGTH) break;
    }
  }

  return code;
};
