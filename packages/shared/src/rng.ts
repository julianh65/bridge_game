const UINT32_RANGE = 0x100000000;

export type RNGState = { state: number };
export type RNGOutput<T> = { value: T; next: RNGState };

export function createRngState(seed: number): RNGState {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new Error("seed must be a finite integer");
  }

  return { state: seed >>> 0 };
}

export function nextUint32(rng: RNGState): RNGOutput<number> {
  const nextState = (rng.state + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = (t ^ (t >>> 14)) >>> 0;

  return { value, next: { state: nextState } };
}

export function randInt(
  rng: RNGState,
  min: number,
  max: number
): RNGOutput<number> {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error("randInt bounds must be integers");
  }
  if (max < min) {
    throw new Error("randInt max must be >= min");
  }

  const range = max - min + 1;
  if (range <= 0 || range > UINT32_RANGE) {
    throw new Error("randInt range out of bounds");
  }

  const threshold = UINT32_RANGE - (UINT32_RANGE % range);
  let state = rng;
  while (true) {
    const { value, next } = nextUint32(state);
    if (value < threshold) {
      return { value: min + (value % range), next };
    }
    state = next;
  }
}

export function rollDie(rng: RNGState, sides = 6): RNGOutput<number> {
  if (!Number.isInteger(sides) || sides <= 0) {
    throw new Error("rollDie sides must be a positive integer");
  }

  return randInt(rng, 1, sides);
}

export function shuffle<T>(rng: RNGState, items: readonly T[]): RNGOutput<T[]> {
  const result = items.slice();
  let state = rng;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const { value: j, next } = randInt(state, 0, i);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
    state = next;
  }

  return { value: result, next: state };
}
