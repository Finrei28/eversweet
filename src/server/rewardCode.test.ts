import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { randomBytesMock } = vi.hoisted(() => ({
  randomBytesMock: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomBytes: randomBytesMock };
});

import {
  REWARD_CODE_ALPHABET,
  REWARD_CODE_LENGTH,
  generateRewardCode,
} from "./rewardCode";

const { randomBytes: realRandomBytes } =
  await vi.importActual<typeof import("node:crypto")>("node:crypto");

/**
 * Real randomness by default; the rejection tests opt in to a fixed buffer with
 * `mockReturnValueOnce`. Reset per test so call counts start from zero - the 5,000-code
 * smoke test would otherwise leave thousands of calls on the tally.
 */
beforeEach(() => {
  randomBytesMock.mockReset();
  randomBytesMock.mockImplementation((size: number) => realRandomBytes(size));
});

describe("REWARD_CODE_ALPHABET", () => {
  /**
   * The schema's doc comment claims 30^8 of entropy and the migration notes lean on it.
   * Pin the 30 so that quietly adding a character desynchronises the two loudly.
   */
  it("is exactly 30 distinct characters", () => {
    expect(REWARD_CODE_ALPHABET).toHaveLength(30);
    expect(new Set(REWARD_CODE_ALPHABET).size).toBe(30);
  });

  it("excludes the characters that get mistyped off a phone screen", () => {
    for (const ambiguous of ["0", "1", "I", "L", "O", "U"]) {
      expect(REWARD_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("is uppercase and digits only", () => {
    expect(REWARD_CODE_ALPHABET).toMatch(/^[A-Z0-9]+$/);
  });
});

describe("generateRewardCode", () => {
  it("produces a code of the right length from the alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRewardCode();

      expect(code).toHaveLength(REWARD_CODE_LENGTH);
      for (const char of code) {
        expect(REWARD_CODE_ALPHABET).toContain(char);
      }
    }
  });

  /**
   * The test that fails if someone "simplifies" the loop back to `byte % 30`.
   *
   * 240 and 255 are both at or above the rejection threshold and must produce no
   * output at all; the bytes after them map straight onto the alphabet by index.
   */
  it("discards bytes at or above 240 rather than folding them in", () => {
    randomBytesMock.mockReturnValueOnce(
      Buffer.from([240, 255, 0, 29, 30, 239, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    );

    const code = generateRewardCode();

    expect(code.slice(0, 5)).toBe(
      [
        REWARD_CODE_ALPHABET[0], // byte 0
        REWARD_CODE_ALPHABET[29], // byte 29
        REWARD_CODE_ALPHABET[0], // byte 30 wraps back to index 0
        REWARD_CODE_ALPHABET[29], // byte 239 is the last accepted value
        REWARD_CODE_ALPHABET[1], // byte 1
      ].join(""),
    );
  });

  /**
   * An entire batch can come back rejected. The function must draw again rather than
   * hang or return a short code.
   */
  it("draws another batch when the first is entirely rejected", () => {
    randomBytesMock
      .mockReturnValueOnce(Buffer.alloc(REWARD_CODE_LENGTH * 2, 255))
      .mockReturnValueOnce(Buffer.alloc(REWARD_CODE_LENGTH * 2, 7));

    const code = generateRewardCode();

    expect(code).toHaveLength(REWARD_CODE_LENGTH);
    expect(code).toBe(REWARD_CODE_ALPHABET[7]!.repeat(REWARD_CODE_LENGTH));
    expect(randomBytesMock).toHaveBeenCalledTimes(2);
  });

  /**
   * Cheap coverage smoke test - 5,000 codes is 40,000 characters, so every one of the
   * 30 should appear many times over. Catches an off-by-one that silently drops the
   * last character of the alphabet. Deliberately not a chi-square test, which flakes.
   */
  it("can emit every character in the alphabet", () => {
    const seen = new Set<string>();

    for (let i = 0; i < 5000; i++) {
      for (const char of generateRewardCode()) seen.add(char);
    }

    expect(seen.size).toBe(REWARD_CODE_ALPHABET.length);
  });
});
