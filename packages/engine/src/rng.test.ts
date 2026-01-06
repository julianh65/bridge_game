import { describe, expect, it } from "vitest";

import {
  createRngState,
  nextUint32,
  randInt,
  rollDie,
  shuffle
} from "@bridgefront/shared";

describe("rng", () => {
  it("produces a stable nextUint32 sequence for a fixed seed", () => {
    let rng = createRngState(123456789);
    const values: number[] = [];

    for (let i = 0; i < 5; i += 1) {
      const res = nextUint32(rng);
      values.push(res.value);
      rng = res.next;
    }

    expect(values).toEqual([
      1107202814,
      4169434471,
      3372958138,
      885470128,
      1301683845
    ]);
  });

  it("randInt stays within bounds and is deterministic", () => {
    let rng = createRngState(99);
    const values: number[] = [];

    for (let i = 0; i < 10; i += 1) {
      const res = randInt(rng, 1, 6);
      expect(res.value).toBeGreaterThanOrEqual(1);
      expect(res.value).toBeLessThanOrEqual(6);
      values.push(res.value);
      rng = res.next;
    }

    expect(values).toEqual([1, 2, 5, 1, 2, 4, 3, 1, 3, 3]);
  });

  it("rollDie mirrors randInt for default sides", () => {
    const rng = createRngState(123);
    const roll = rollDie(rng);
    const byRand = randInt(rng, 1, 6);

    expect(roll.value).toBe(byRand.value);
    expect(roll.next).toEqual(byRand.next);
  });

  it("shuffle returns a deterministic permutation", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const rng = createRngState(42);
    const { value: shuffled } = shuffle(rng, input);

    expect(shuffled).toEqual([2, 4, 3, 5, 6, 1]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);

    const sorted = [...shuffled].sort((a, b) => a - b);
    expect(sorted).toEqual(input);
  });
});
