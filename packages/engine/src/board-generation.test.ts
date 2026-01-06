import { describe, expect, it } from "vitest";

import { axialDistance, createRngState, parseHexKey } from "@bridgefront/shared";

import { createBaseBoard, getCapitalSlots, placeSpecialTiles } from "./board-generation";

const withCapitals = (radius: number, playerCount: number) => {
  const board = createBaseBoard(radius);
  const capitals = getCapitalSlots(playerCount, radius);
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
    expect(getCapitalSlots(2, 4)).toEqual(["4,0", "-4,0"]);
    expect(getCapitalSlots(3, 4)).toEqual(["4,0", "-4,4", "0,-4"]);
    expect(getCapitalSlots(4, 4)).toEqual(["4,0", "0,4", "-4,0", "0,-4"]);
    expect(getCapitalSlots(6, 4)).toEqual(["4,0", "0,4", "-4,4", "-4,0", "0,-4", "4,-4"]);
  });

  it("returns special five-player capital slots for radius 5", () => {
    expect(getCapitalSlots(5, 5)).toEqual(["-5,0", "-4,5", "2,2", "5,-3", "1,-5"]);
  });

  it("rejects invalid player counts and unsupported radius", () => {
    expect(() => getCapitalSlots(1, 4)).toThrow("playerCount must be between 2 and 6");
    expect(() => getCapitalSlots(5, 4)).toThrow("5-player capital slots require radius 5");
    expect(() => getCapitalSlots(7, 4)).toThrow("playerCount must be between 2 and 6");
  });

  it("places special tiles deterministically and respects constraints", () => {
    const { board, capitals } = withCapitals(4, 2);
    const rng = createRngState(12345);
    const first = placeSpecialTiles(board, rng, {
      capitalHexes: capitals,
      forgeCount: 1,
      mineCount: 3
    });
    const second = placeSpecialTiles(board, rng, {
      capitalHexes: capitals,
      forgeCount: 1,
      mineCount: 3
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
        expect(distanceBetween(key, capital)).toBeGreaterThanOrEqual(2);
      }
    }

    for (const key of first.forgeKeys) {
      const dist = distanceBetween(key, "0,0");
      expect([2, 3]).toContain(dist);
      expect(first.board.hexes[key].tile).toBe("forge");
    }

    for (const key of first.homeMineKeys) {
      const distToCapitals = capitals.map((capital) => distanceBetween(key, capital));
      expect(distToCapitals.some((dist) => dist === 2)).toBe(true);
      expect(distToCapitals.every((dist) => dist >= 2)).toBe(true);
      expect(first.board.hexes[key].tile).toBe("mine");
    }

    const remainingMines = first.mineKeys.filter((key) => !first.homeMineKeys.includes(key));
    for (const key of remainingMines) {
      expect(distanceBetween(key, "0,0")).toBe(2);
      expect(first.board.hexes[key].tile).toBe("mine");
    }

    for (const key of first.mineKeys) {
      expect([4, 5, 6]).toContain(first.board.hexes[key].mineValue);
    }
  });
});
