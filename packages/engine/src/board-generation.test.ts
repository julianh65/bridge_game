import { describe, expect, it } from "vitest";

import { axialDistance, createRngState, parseEdgeKey, parseHexKey } from "@bridgefront/shared";

import {
  createBaseBoard,
  getCapitalSlots,
  placeRandomBridges,
  placeSpecialTiles
} from "./board-generation";
import { DEFAULT_CONFIG } from "./config";

const withCapitals = (playerCount: number) => {
  const radius = DEFAULT_CONFIG.boardRadiusByPlayerCount[playerCount] ?? 0;
  const board = createBaseBoard(radius);
  const capitals = getCapitalSlots(
    playerCount,
    radius,
    DEFAULT_CONFIG.capitalSlotsByPlayerCount
  );
  const hexes = { ...board.hexes };
  for (const key of capitals) {
    hexes[key] = { ...hexes[key], tile: "capital" };
  }
  return { board: { ...board, hexes }, capitals };
};

const distanceBetween = (a: string, b: string) => {
  return axialDistance(parseHexKey(a), parseHexKey(b));
};

describe("board generation", () => {
  it("creates a base board with a centered tile", () => {
    const board = createBaseBoard(0);
    expect(Object.keys(board.hexes)).toHaveLength(1);
    expect(board.hexes["0,0"]).toBeDefined();
    expect(board.hexes["0,0"].tile).toBe("center");
    expect(board.bridges).toEqual({});
    expect(board.units).toEqual({});
  });

  it("marks non-center tiles as normal", () => {
    const board = createBaseBoard(1);
    expect(Object.keys(board.hexes)).toHaveLength(7);
    for (const [key, hex] of Object.entries(board.hexes)) {
      if (key === "0,0") {
        expect(hex.tile).toBe("center");
      } else {
        expect(hex.tile).toBe("normal");
      }
    }
  });

  it("returns corner capital slots for common player counts", () => {
    expect(getCapitalSlots(2, 3)).toEqual(["3,0", "-3,0"]);
    expect(getCapitalSlots(3, 3)).toEqual(["3,0", "-3,3", "0,-3"]);
    expect(getCapitalSlots(4, 4)).toEqual(["4,0", "0,4", "-4,0", "0,-4"]);
    expect(getCapitalSlots(6, 4)).toEqual(["4,0", "0,4", "-4,4", "-4,0", "0,-4", "4,-4"]);
  });

  it("uses capital slot overrides when provided", () => {
    const overrides = {
      2: ["2,0", "-2,0"]
    };
    expect(getCapitalSlots(2, 3, overrides)).toEqual(["2,0", "-2,0"]);
  });

  it("rejects invalid player counts and invalid overrides", () => {
    expect(() => getCapitalSlots(1, 4)).toThrow("playerCount must be between 2 and 6");
    expect(() =>
      getCapitalSlots(2, 2, {
        2: ["2,0", "2,0"]
      })
    ).toThrow("capital slot override contains duplicates");
    expect(() =>
      getCapitalSlots(2, 2, {
        2: ["3,0", "-2,0"]
      })
    ).toThrow("capital slot 3,0 is outside board radius");
    expect(() => getCapitalSlots(7, 4)).toThrow("playerCount must be between 2 and 6");
  });

  it("places special tiles deterministically and respects constraints", () => {
    const { board, capitals } = withCapitals(2);
    const rng = createRngState(12345);
    const rules = DEFAULT_CONFIG.boardGenerationRules;
    const first = placeSpecialTiles(board, rng, {
      capitalHexes: capitals,
      forgeCount: 1,
      mineCount: 3,
      rules
    });
    const second = placeSpecialTiles(board, rng, {
      capitalHexes: capitals,
      forgeCount: 1,
      mineCount: 3,
      rules
    });

    expect(first.forgeKeys).toEqual(second.forgeKeys);
    expect(first.homeMineKeys).toEqual(second.homeMineKeys);
    expect(first.mineKeys).toEqual(second.mineKeys);

    const allSpecial = [...first.forgeKeys, ...first.mineKeys];
    expect(new Set(allSpecial).size).toBe(allSpecial.length);
    for (const key of allSpecial) {
      expect(key).not.toBe("0,0");
      expect(capitals).not.toContain(key);
      for (const capital of capitals) {
        expect(distanceBetween(key, capital)).toBeGreaterThanOrEqual(rules.minDistanceFromCapital);
      }
    }

    for (const key of first.forgeKeys) {
      const dist = distanceBetween(key, "0,0");
      expect(rules.forgeDistanceFromCenter).toContain(dist);
      expect(first.board.hexes[key].tile).toBe("forge");
    }

    for (const key of first.homeMineKeys) {
      const distToCapitals = capitals.map((capital) => distanceBetween(key, capital));
      expect(distToCapitals.some((dist) => dist === rules.homeMineDistanceFromCapital)).toBe(true);
      expect(
        distToCapitals.every((dist) => dist >= rules.homeMineMinDistanceFromOtherCapitals)
      ).toBe(true);
      expect(first.board.hexes[key].tile).toBe("mine");
    }

    const remainingMines = first.mineKeys.filter((key) => !first.homeMineKeys.includes(key));
    for (const key of remainingMines) {
      expect(rules.mineDistanceFromCenter).toContain(distanceBetween(key, "0,0"));
      expect(first.board.hexes[key].tile).toBe("mine");
    }

    for (const key of first.mineKeys) {
      expect(rules.mineValueWeights.map((entry) => entry.value)).toContain(
        first.board.hexes[key].mineValue
      );
    }
  });

  it("allows fewer mines than capitals", () => {
    const { board, capitals } = withCapitals(4);
    const rng = createRngState(2024);
    const rules = {
      ...DEFAULT_CONFIG.boardGenerationRules,
      minDistanceFromCapital: 1,
      homeMineDistanceFromCapital: 1,
      homeMineMinDistanceFromOtherCapitals: 0,
      mineDistanceFromCenter: [1, 2, 3]
    };

    const result = placeSpecialTiles(board, rng, {
      capitalHexes: capitals,
      forgeCount: 0,
      mineCount: 2,
      rules
    });

    expect(result.mineKeys).toHaveLength(2);
    expect(result.homeMineKeys).toHaveLength(2);
  });

  it("falls back to any distance when preferred forge distances are unavailable", () => {
    const { board, capitals } = withCapitals(2);
    const rng = createRngState(4242);
    const rules = {
      ...DEFAULT_CONFIG.boardGenerationRules,
      minDistanceFromCapital: 0,
      homeMineDistanceFromCapital: 1,
      homeMineMinDistanceFromOtherCapitals: 0,
      mineDistanceFromCenter: [1, 2],
      forgeDistanceFromCenter: [99]
    };
    const result = placeSpecialTiles(board, rng, {
      capitalHexes: capitals,
      forgeCount: 1,
      mineCount: capitals.length,
      rules
    });
    expect(result.forgeKeys).toHaveLength(1);
    const forgeKey = result.forgeKeys[0];
    const dist = distanceBetween(forgeKey, "0,0");
    expect(rules.forgeDistanceFromCenter).not.toContain(dist);
    expect(result.board.hexes[forgeKey].tile).toBe("forge");
  });

  it("places random bridges away from capitals deterministically", () => {
    const { board, capitals } = withCapitals(3);
    const rng = createRngState(777);
    const count = DEFAULT_CONFIG.tileCountsByPlayerCount[3].randomBridges;

    const first = placeRandomBridges(board, rng, {
      capitalHexes: capitals,
      count,
      rules: DEFAULT_CONFIG.boardGenerationRules
    });
    const second = placeRandomBridges(board, createRngState(777), {
      capitalHexes: capitals,
      count,
      rules: DEFAULT_CONFIG.boardGenerationRules
    });

    expect(first.edgeKeys).toHaveLength(count);
    expect([...first.edgeKeys].sort()).toEqual([...second.edgeKeys].sort());

    for (const edgeKey of first.edgeKeys) {
      const [a, b] = parseEdgeKey(edgeKey);
      expect(capitals).not.toContain(a);
      expect(capitals).not.toContain(b);
      expect(a).not.toBe("0,0");
      expect(b).not.toBe("0,0");
    }
  });
});
